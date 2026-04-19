export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export function handleAIError(status: number) {
  if (status === 429) {
    return new Response(
      JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }),
      { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (status === 402) {
    return new Response(
      JSON.stringify({ error: "AI credits exhausted. Please add credits in Settings → Workspace → Usage." }),
      { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  return new Response(
    JSON.stringify({ error: "AI service error. Please try again." }),
    { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
