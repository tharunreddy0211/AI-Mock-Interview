import { pgTable, text, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";

export type InterviewMessage = {
  role: "user" | "model";
  text: string;
};

export const interviewSessions = pgTable("interview_sessions", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  questionCount: integer("question_count").notNull().default(0),
  messages: jsonb("messages").notNull().default([]).$type<InterviewMessage[]>(),
  complete: boolean("complete").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});
