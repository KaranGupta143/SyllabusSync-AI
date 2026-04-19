import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleAIError } from "../_shared/cors.ts";

const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY")!;
const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Simple chunker: ~600 chars with 100 overlap, sentence-aware-ish
function chunk(text: string, size = 700, overlap = 120): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + size, clean.length);
    if (end < clean.length) {
      const lastPeriod = clean.lastIndexOf(". ", end);
      if (lastPeriod > i + size * 0.5) end = lastPeriod + 1;
    }
    out.push(clean.slice(i, end).trim());
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return out.filter((c) => c.length > 30);
}

// Deterministic 768-dim hashed bag-of-words embedding (no external API needed).
// Good enough for syllabus chunk retrieval within a single document.
const EMBED_DIM = 768;

function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function embedOne(text: string): number[] {
  const v = new Array(EMBED_DIM).fill(0);
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  for (const tok of tokens) {
    const h = hashStr(tok);
    const idx = h % EMBED_DIM;
    const sign = (h >> 16) & 1 ? 1 : -1;
    v[idx] += sign;
    // bigram-ish second hash for richer signal
    const h2 = hashStr("_" + tok);
    v[h2 % EMBED_DIM] += ((h2 >> 16) & 1 ? 1 : -1) * 0.5;
  }
  // L2 normalize
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

async function embed(texts: string[]): Promise<number[][]> {
  return texts.map(embedOne);
}

async function extractTopics(text: string): Promise<string[]> {
  const sample = text.slice(0, 8000);
  const res = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${AI_GATEWAY_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        {
          role: "system",
          content:
            "You extract a clean list of distinct math topics from a syllabus. Return only the JSON via the tool.",
        },
        { role: "user", content: `Extract distinct math topics from this syllabus:\n\n${sample}` },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "return_topics",
            description: "Return the extracted topics",
            parameters: {
              type: "object",
              properties: {
                topics: {
                  type: "array",
                  items: { type: "string" },
                  description: "Concise topic names, 3-6 words each, max 20 topics",
                },
              },
              required: ["topics"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "return_topics" } },
    }),
  });
  if (!res.ok) {
    console.error("Topic extract error", res.status, await res.text());
    return [];
  }
  const data = await res.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) return [];
  try {
    return JSON.parse(args).topics ?? [];
  } catch {
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { device_id, title, text } = await req.json();
    if (!device_id || !text || typeof text !== "string" || text.trim().length < 50) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const topics = await extractTopics(text);

    const { data: syllabus, error: sErr } = await supabase
      .from("syllabi")
      .insert({
        device_id,
        title: title || "Untitled Syllabus",
        topics,
      })
      .select()
      .single();
    if (sErr) throw sErr;

    const chunks = chunk(text);
    // Embed in batches of 50
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < chunks.length; i += 50) {
      const batch = chunks.slice(i, i + 50);
      try {
        const embs = await embed(batch);
        allEmbeddings.push(...embs);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "unknown";
        if (msg.includes("429")) return handleAIError(429);
        if (msg.includes("402")) return handleAIError(402);
        throw e;
      }
    }

    const rows = chunks.map((content, i) => ({
      syllabus_id: syllabus.id,
      content,
      topic: null,
      page_ref: `Chunk ${i + 1}`,
      embedding: allEmbeddings[i] as unknown as string,
    }));

    // Insert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from("syllabus_chunks").insert(rows.slice(i, i + 100));
      if (error) throw error;
    }

    return new Response(
      JSON.stringify({ syllabus_id: syllabus.id, topics, chunk_count: chunks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("ingest-syllabus error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
