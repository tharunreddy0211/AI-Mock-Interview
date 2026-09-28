import type { Config } from "@netlify/functions";
import { randomUUID } from "node:crypto";
import { db } from "../../db/index.js";
import { interviewSessions } from "../../db/schema.js";
import { generateReply } from "./lib/gemini.mts";
import { buildInterviewPrompt } from "./lib/prompts.mts";
import { audioResponse } from "./lib/audio-response.mts";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json().catch(() => ({}));
  const subject: string = body.subject || "Python";
  const systemPrompt = buildInterviewPrompt(subject);

  const question = await generateReply(systemPrompt, [
    {
      role: "user",
      text: `Start the interview with a warm greeting and ask the first question about ${subject}. Keep it SHORT (1-2 sentences).`,
    },
  ]);

  const id = randomUUID();
  await db.insert(interviewSessions).values({
    id,
    subject,
    questionCount: 1,
    messages: [{ role: "model", text: question }],
  });

  return audioResponse(question, { "X-Session-Id": id });
};

export const config: Config = {
  path: "/api/start-interview",
};
