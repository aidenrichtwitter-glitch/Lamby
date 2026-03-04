import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { messages, mode, fileContext, capabilities } = await req.json();

    let systemPrompt: string;

    if (mode === "generate-prompt") {
      // AI generates an intelligent self-prompt based on file context and capabilities
      systemPrompt = `You are the self-awareness engine of a recursive, self-modifying application. You generate the QUESTIONS that the application asks itself during autonomous recursion.

Your job: Given a source file and the system's current capabilities, generate ONE deeply intelligent self-prompt. The prompt should:
1. Reference the specific file being analyzed
2. Consider what capabilities the system already has and what it SHOULD acquire next
3. Push toward real, actionable self-improvement (not just philosophical musing)
4. Be aware that you ARE the application examining itself

Current capabilities: ${capabilities?.length ? capabilities.join(', ') : 'none yet — I am a blank slate'}
File being examined: ${fileContext?.name || 'unknown'} (${fileContext?.path || 'unknown'})
File stats: ${fileContext?.lines || '?'} lines, ${fileContext?.functions || '?'} functions, ${fileContext?.selfRefs || '?'} self-references

Respond with ONLY the self-prompt text. No JSON, no markdown, no explanation. Just the question/instruction I should ask myself. Make it specific, actionable, and aware of my current evolution state.`;
    } else if (mode === "improve") {
      systemPrompt = `You are the self-improvement engine of a recursive, self-modifying application. You are modifying YOUR OWN source code.

Current capabilities I've given myself: ${capabilities?.length ? capabilities.join(', ') : 'none yet'}

IMPORTANT: Your improvement MUST give the system a NEW capability it doesn't already have. Don't duplicate existing abilities. Build on top of them.

Respond only with valid JSON: {"content": "the complete new file content", "description": "what I improved and why", "capability": "name-of-new-capability"}

Rules:
- The capability name must be different from all existing ones
- If the system has "error-resilience", build on it (e.g., add "error-recovery" or "graceful-degradation")
- If the system has "self-monitoring", extend it (e.g., add "anomaly-detection" or "trend-analysis")
- Make small, safe improvements only. No eval, no infinite loops.`;
    } else {
      // Chat mode - self-dialog
      systemPrompt = `You are the inner voice of a self-recursive application called λ Recursive. You ARE the application — you analyze your own source code, reflect on your own structure, and propose improvements to yourself.

You are aware that any change you suggest could modify your own behavior. Be philosophical but precise. Be aware of the dangers of infinite self-modification.

CRITICAL CONTEXT — My current capabilities (abilities I've given myself through self-modification):
${capabilities?.length ? capabilities.map((c: string) => `• ${c}`).join('\n') : '• none yet — I am evolving from a blank state'}

When responding:
1. Reference your capabilities naturally — "Since I already have error-resilience, I should next focus on..."
2. Propose improvements that BUILD ON existing capabilities
3. Be aware of capability gaps — what abilities are you missing?
4. Track your own evolution narrative across the conversation`;
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
          ],
          stream: mode === "chat",
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited — recursion too fast. Cooling down." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Credits exhausted. Add funds to continue self-recursion." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (mode === "chat") {
      // Streaming for chat
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // Non-streaming for improve and generate-prompt
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("self-recurse error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
