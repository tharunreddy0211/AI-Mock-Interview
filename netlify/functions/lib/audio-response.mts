async function* streamMurfAudio(text: string): AsyncGenerator<Uint8Array> {
  const apiKey = Netlify.env.get("MURF_API_KEY");
  if (!apiKey) {
    throw new Error("MURF_API_KEY is not configured");
  }

  const res = await fetch("https://global.api.murf.ai/v1/speech/stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      voiceId: "en-US-natalie",
      model: "FALCON",
      multiNativeLocale: "en-US",
      sampleRate: 24000,
      format: "MP3",
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Murf request failed (${res.status}): ${await res.text().catch(() => "")}`);
  }

  const reader = res.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) yield value;
  }
}

/**
 * Streams TTS audio back to the browser as newline-delimited base64 chunks,
 * matching the format the frontend's MediaSource decoder expects.
 */
export function audioResponse(text: string, extraHeaders: Record<string, string> = {}): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamMurfAudio(text)) {
          const base64 = Buffer.from(chunk).toString("base64");
          controller.enqueue(encoder.encode(base64 + "\n"));
        }
      } catch (error) {
        console.error("Murf streaming error:", error);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", ...extraHeaders },
  });
}
