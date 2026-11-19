CREATE TABLE "chat_message_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"rating" text NOT NULL,
	"reason" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_feedback_rating_check" CHECK ("chat_message_feedback"."rating" IN ('up', 'partial', 'down')),
	CONSTRAINT "chat_message_feedback_reason_check" CHECK ("chat_message_feedback"."reason" IS NULL OR "chat_message_feedback"."reason" IN ('incorrect', 'incomplete', 'unclear', 'off_topic', 'other'))
);
--> statement-breakpoint
ALTER TABLE "chat_message_feedback" ADD CONSTRAINT "chat_message_feedback_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_feedback" ADD CONSTRAINT "chat_message_feedback_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chat_message_feedback_message_account" ON "chat_message_feedback" USING btree ("message_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_chat_message_feedback_created" ON "chat_message_feedback" USING btree ("created_at");