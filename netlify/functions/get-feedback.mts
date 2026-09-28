import type { Config } from "@netlify/functions";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { interviewSessions } from "../../db/schema.js";
import { generateReply } from "./lib/gemini.mts";
import { buildInterviewPrompt, FEEDBACK_PROMPT } from "./lib/prompts.mts";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = body.sessionId;
  if (typeof sessionId !== "string") {
    return new Response("Missing sessionId", { status: 400 });
  }

  const [session] = await db.select().from(interviewSessions).where(eq(interviewSessions.id, sessionId));
  if (!session) {
    return new Response("Interview session not found", { status: 404 });
  }

  const systemPrompt = buildInterviewPrompt(session.subject);
  const messages = [
    ...session.messages,
    {
      role: "user" as const,
      text: `${FEEDBACK_PROMPT}\n\nReview our complete ${session.subject} interview conversation and provide detailed feedback.`,
    },
  ];

  const raw = await generateReply(systemPrompt, messages);
  let cleaned = raw.trim();
  if (cleaned.includes("```")) {
    cleaned = cleaned.split("```")[1].replace(/^json/i, "").trim();
  }

  const feedback = JSON.parse(cleaned);
  return Response.json({ success: true, feedback });
};

export const config: Config = {
  path: "/api/get-feedback",
};
