CREATE TABLE "chat_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_session_id" uuid NOT NULL,
	"user_message_id" uuid NOT NULL,
	"assistant_message_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider" text,
	"retrieved_chunks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timings_ms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"locked_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD CONSTRAINT "chat_generation_jobs_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD CONSTRAINT "chat_generation_jobs_chat_session_id_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD CONSTRAINT "chat_generation_jobs_user_message_id_chat_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD CONSTRAINT "chat_generation_jobs_assistant_message_id_chat_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "chat_generation_jobs_status_locked_created_idx" ON "chat_generation_jobs" USING btree ("status","locked_at","created_at");
--> statement-breakpoint
CREATE INDEX "chat_generation_jobs_user_status_idx" ON "chat_generation_jobs" USING btree ("user_id","status");
--> statement-breakpoint
CREATE INDEX "chat_generation_jobs_session_status_idx" ON "chat_generation_jobs" USING btree ("chat_session_id","status");
