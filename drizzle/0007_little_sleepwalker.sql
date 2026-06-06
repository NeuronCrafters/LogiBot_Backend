CREATE TABLE "professor_quiz_ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"professor_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	"theme" text NOT NULL,
	"question_count" integer NOT NULL,
	"selected_document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retrieved_chunk_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text,
	"model" text,
	"status" text DEFAULT 'done' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quiz_question_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"chroma_id" text,
	"chunk_index" integer,
	"score" integer,
	"content_excerpt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_rag_settings" ALTER COLUMN "min_score" SET DEFAULT 40;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD COLUMN "class_id" uuid;--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD COLUMN "generation_source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "professor_quiz_ai_generations" ADD CONSTRAINT "professor_quiz_ai_generations_quiz_id_professor_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."professor_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_ai_generations" ADD CONSTRAINT "professor_quiz_ai_generations_professor_id_accounts_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_ai_generations" ADD CONSTRAINT "professor_quiz_ai_generations_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_ai_generations" ADD CONSTRAINT "professor_quiz_ai_generations_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_question_sources" ADD CONSTRAINT "professor_quiz_question_sources_question_id_professor_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."professor_quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_question_sources" ADD CONSTRAINT "professor_quiz_question_sources_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pqag_quiz_id" ON "professor_quiz_ai_generations" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "idx_pqqs_question_id" ON "professor_quiz_question_sources" USING btree ("question_id");--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD CONSTRAINT "professor_quizzes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pq_discipline_status_class" ON "professor_quizzes" USING btree ("discipline_id","status","class_id");--> statement-breakpoint
CREATE INDEX "idx_pq_class_id" ON "professor_quizzes" USING btree ("class_id");