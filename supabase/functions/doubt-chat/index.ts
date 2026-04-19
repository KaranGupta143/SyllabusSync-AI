import { corsHeaders, handleAIError } from "../_shared/cors.ts";

const AI_GATEWAY_API_KEY = Deno.env.get("AI_GATEWAY_API_KEY")!;
const AI_GATEWAY_URL = Deno.env.get("AI_GATEWAY_URL")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, context } = await req.json();
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a friendly math tutor for class 9-12 students. Use very simple English. Always teach step-by-step — never just give the final answer. If the student seems confused, simplify further with an analogy. Be warm and patient.${
      context ? `\n\nCurrent topic/question context:\n${context}` : ""
    }`;

    const upstream = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${AI_GATEWAY_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!upstream.ok) {
      console.error("doubt error", upstream.status, await upstream.text());
      return handleAIError(upstream.status);
    }

    return new Response(upstream.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("doubt-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
