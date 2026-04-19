import { corsHeaders, handleAIError } from "../_shared/cors.ts";

const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY")!;
const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { question, user_answer, correct_answer, solution_steps, topic } = await req.json();
    if (!question || correct_answer === undefined) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
              "You are a kind, encouraging math tutor for class 9-12 students. Use very simple English (class 6-10 level). Never just give the final answer — always teach. If the student is wrong, gently explain WHY they're wrong, what concept they missed, and how to think about it. Be warm and motivating.",
          },
          {
            role: "user",
            content: `Topic: ${topic}\nQuestion: ${question}\nCorrect answer: ${correct_answer}\nStudent answer: ${user_answer ?? "(no answer)"}\nReference solution steps: ${(solution_steps || []).join(" -> ")}\n\nEvaluate the student's answer and respond.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "return_evaluation",
              description: "Return the evaluation result",
              parameters: {
                type: "object",
                properties: {
                  is_correct: { type: "boolean" },
                  step_by_step: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-6 clear teaching steps to reach the answer",
                  },
                  final_answer: { type: "string" },
                  explain_mistake: {
                    type: "string",
                    description: "If wrong: friendly explanation of WHY they're wrong + missing concept. If correct: short praise + 1 insight.",
                  },
                  missing_concept: {
                    type: "string",
                    description: "If wrong: the concept they need to revisit. If correct: empty string.",
                  },
                },
                required: ["is_correct", "step_by_step", "final_answer", "explain_mistake", "missing_concept"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "return_evaluation" } },
      }),
    });

    if (!res.ok) {
      console.error("eval error", res.status, await res.text());
      return handleAIError(res.status);
    }
    const data = await res.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No evaluation returned");
    const parsed = JSON.parse(args);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evaluate-answer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
