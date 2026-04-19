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
    const { syllabus_id, topic, count = 10 } = await req.json();
    if (!syllabus_id || !topic) {
      return new Response(JSON.stringify({ error: "syllabus_id and topic required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Retrieve relevant chunks
    let chunks: { content: string; page_ref: string | null }[] = [];
    try {
      const queryEmb = await embedOne(`Topic: ${topic}. Find sections explaining and giving examples of this topic.`);
      const { data, error } = await supabase.rpc("match_syllabus_chunks", {
        query_embedding: queryEmb as unknown as string,
        match_syllabus_id: syllabus_id,
        match_count: 6,
      });
      if (error) throw error;
      chunks = data ?? [];
    } catch (e) {
      const msg = e instanceof Error ? e.message : "unknown";
      if (msg.includes("429")) return handleAIError(429);
      if (msg.includes("402")) return handleAIError(402);
      // Fallback: pull any chunks
      const { data } = await supabase
        .from("syllabus_chunks")
        .select("content, page_ref")
        .eq("syllabus_id", syllabus_id)
        .limit(6);
      chunks = data ?? [];
    }

    const groundingContext = chunks
      .map((c, i) => `[Source ${i + 1} | ${c.page_ref ?? "Syllabus"}]\n${c.content}`)
      .join("\n\n");
    const groundingRef = chunks[0]?.page_ref ?? "Syllabus";

    const res = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_GATEWAY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are an expert math teacher creating quizzes for class 9-12 students. Every question MUST be grounded in the provided syllabus context. Mix MCQ and short-answer. Keep wording simple. Provide clean step-by-step solutions.",
          },
          {
            role: "user",
            content: `Topic: ${topic}\n\nSYLLABUS CONTEXT:\n${groundingContext || "(no chunks retrieved — base on standard CBSE syllabus for this topic)"}\n\nGenerate exactly ${count} quiz questions for this topic, grounded in the context above.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_quiz",
              description: "Return the quiz questions",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        type: { type: "string", enum: ["mcq", "short"] },
                        options: { type: "array", items: { type: "string" } },
                        correct_answer: { type: "string" },
                        solution_steps: { type: "array", items: { type: "string" } },
                        grounding_ref: { type: "string", description: "e.g. 'Chunk 2' or topic name" },
                      },
                      required: ["question", "type", "correct_answer", "solution_steps", "grounding_ref"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_quiz" } },
      }),
    });

    if (!res.ok) {
      console.error("quiz error", res.status, await res.text());
      return handleAIError(res.status);
    }
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No quiz returned");
    const parsed = JSON.parse(args);

    // Attach grounding fallback
    const questions = (parsed.questions ?? []).map((q: Record<string, unknown>) => ({
      ...q,
      grounding_ref: q.grounding_ref || groundingRef,
    }));

    return new Response(JSON.stringify({ questions, topic }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-quiz error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
