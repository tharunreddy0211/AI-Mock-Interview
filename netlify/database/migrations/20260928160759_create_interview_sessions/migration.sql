CREATE TABLE "interview_sessions" (
	"id" text PRIMARY KEY,
	"subject" text NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"messages" jsonb DEFAULT '[]' NOT NULL,
	"complete" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now()
);
