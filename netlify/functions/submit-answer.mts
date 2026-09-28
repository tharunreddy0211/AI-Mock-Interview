import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { interviewSessions, type InterviewMessage } from "../../db/schema.js";
import { generateReply } from "./lib/gemini.mts";
import { buildInterviewPrompt } from "./lib/prompts.mts";
import { transcribeAudio } from "./lib/assemblyai.mts";
import { audioResponse } from "./lib/audio-response.mts";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const form = await req.formData();
  const sessionId = form.get("sessionId");
  const audio = form.get("audio");

  if (typeof sessionId !== "string" || !(audio instanceof File)) {
    return new Response("Missing sessionId or audio", { status: 400 });
  }

  const [session] = await db.select().from(interviewSessions).where(eq(interviewSessions.id, sessionId));
  if (!session) {
    return new Response("Interview session not found", { status: 404 });
  }

  const buffer = new Uint8Array(await audio.arrayBuffer());
  let answer = await transcribeAudio(buffer);
  if (!answer || !answer.trim()) {
    answer = "[Candidate provided a verbal response]";
  }

  const systemPrompt = buildInterviewPrompt(session.subject);
  const history: InterviewMessage[] = [...session.messages, { role: "user", text: answer }];

  if (session.questionCount >= 5) {
    const closing = await generateReply(systemPrompt, [
      ...history,
      {
        role: "user",
        text: "That was the 5th question. Briefly acknowledge their ACTUAL answer and let them know the interview is complete. Keep it SHORT.",
      },
    ]);

    await db
      .update(interviewSessions)
      .set({ messages: [...history, { role: "model", text: closing }], complete: true })
      .where(eq(interviewSessions.id, sessionId));

    return audioResponse(closing, { "X-Interview-Complete": "true" });
  }

  const nextQuestionNumber = session.questionCount + 1;
  const prompt = `The candidate just answered question ${session.questionCount}.

Look at their ACTUAL answer above. Do NOT assume or make up what they said.

Now ask question ${nextQuestionNumber} of 5:
1. Briefly acknowledge what they ACTUALLY said (1 sentence) - quote their exact words if needed
2. Ask your next question that builds on their REAL response (1-2 sentences)
3. If they said "I don't know" or gave a wrong answer, acknowledge that and ask something simpler
4. Keep the TOTAL response under 3 sentences

Be conversational but CONCISE. Only reference what they truly said.`;

  const question = await generateReply(systemPrompt, [...history, { role: "user", text: prompt }]);

  await db
    .update(interviewSessions)
    .set({ messages: [...history, { role: "model", text: question }], questionCount: nextQuestionNumber })
    .where(eq(interviewSessions.id, sessionId));

  return audioResponse(question, { "X-Question-Number": String(nextQuestionNumber) });
};

export const config: Config = {
  path: "/api/submit-answer",
};
