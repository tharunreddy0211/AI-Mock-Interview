export async function transcribeAudio(audio: Uint8Array): Promise<string> {
  const apiKey = Netlify.env.get("ASSEMBLYAI_API_KEY");
  if (!apiKey) {
    throw new Error("ASSEMBLYAI_API_KEY is not configured");
  }

  const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: { authorization: apiKey },
    body: audio,
  });
  if (!uploadRes.ok) {
    throw new Error(`AssemblyAI upload failed (${uploadRes.status})`);
  }
  const { upload_url } = await uploadRes.json();

  const transcriptRes = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: upload_url,
      language_detection: true,
      speaker_labels: true,
    }),
  });
  if (!transcriptRes.ok) {
    throw new Error(`AssemblyAI transcript request failed (${transcriptRes.status})`);
  }
  const { id } = await transcriptRes.json();

  const deadline = Date.now() + 50_000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
      headers: { authorization: apiKey },
    });
    const data = await pollRes.json();
    if (data.status === "completed") return data.text ?? "";
    if (data.status === "error") throw new Error(`AssemblyAI transcription error: ${data.error}`);
  }

  throw new Error("AssemblyAI transcription timed out");
}
