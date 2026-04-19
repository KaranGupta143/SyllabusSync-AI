import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders, handleAIError } from "../_shared/cors.ts";

const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY")!;
const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Deterministic 768-dim hashed embedding (matches ingest-syllabus).
const EMBED_DIM = 768;
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
async function embedOne(text: string): Promise<number[]> {
  const v = new Array(EMBED_DIM).fill(0);
  const tokens = text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((t) => t.length > 1);
  for (const tok of tokens) {
    const h = hashStr(tok);
    v[h % EMBED_DIM] += (h >> 16) & 1 ? 1 : -1;
    const h2 = hashStr("_" + tok);
    v[h2 % EMBED_DIM] += ((h2 >> 16) & 1 ? 1 : -1) * 0.5;
  }
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm) || 1;
  return v.map((x) => x / norm);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { topic, syllabus_id } = await req.json();
    if (!topic) {
      return new Response(JSON.stringify({ error: "topic required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let context = "";
    if (syllabus_id) {
      try {
        const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
        const emb = await embedOne(`Concept explanation of ${topic}`);
        const { data } = await supabase.rpc("match_syllabus_chunks", {
          query_embedding: emb as unknown as string,
          match_syllabus_id: syllabus_id,
          match_count: 4,
        });
        context = (data ?? []).map((c: { content: string }) => c.content).join("\n\n");
      } catch (e) {
        console.error("retrieval failed:", e);
      }
    }

    const res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_GATEWAY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a friendly math teacher. Teach the topic to a beginner using very simple English. Always include: (1) clear concept explanation, (2) a real-life analogy, (3) one fully worked example with steps.",
          },
          {
            role: "user",
            content: `Teach me: ${topic}\n\n${context ? `Syllabus context:\n${context}` : ""}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_lesson",
              parameters: {
                type: "object",
                properties: {
                  concept: { type: "string", description: "Clear, simple explanation of the concept (3-5 short paragraphs)" },
                  analogy: { type: "string", description: "Real-life analogy" },
                  example_problem: { type: "string" },
                  example_steps: { type: "array", items: { type: "string" } },
                  example_answer: { type: "string" },
                },
                required: ["concept", "analogy", "example_problem", "example_steps", "example_answer"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_lesson" } },
      }),
    });

    if (!res.ok) {
      console.error("teach error", res.status, await res.text());
      return handleAIError(res.status);
    }
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No lesson returned");
    return new Response(args, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("teach-topic error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
