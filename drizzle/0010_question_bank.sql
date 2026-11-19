CREATE TABLE "assessment_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	"type" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"weight" double precision DEFAULT 1 NOT NULL,
	"language" text NOT NULL,
	"subject" text,
	"concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"statement" text NOT NULL,
	"content" jsonb NOT NULL,
	"source_quiz_question_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_questions_type_check" CHECK ("assessment_questions"."type" IN ('quiz', 'truth_table', 'parsons', 'translation', 'essay')),
	CONSTRAINT "assessment_questions_language_check" CHECK ("assessment_questions"."language" IN ('pt-BR', 'en-US', 'es-ES')),
	CONSTRAINT "assessment_questions_weight_check" CHECK ("assessment_questions"."weight" >= 0.5 AND "assessment_questions"."weight" <= 10),
	CONSTRAINT "assessment_questions_version_check" CHECK ("assessment_questions"."version" >= 1)
);
--> statement-breakpoint
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_owner_id_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_source_quiz_question_id_professor_quiz_questions_id_fk" FOREIGN KEY ("source_quiz_question_id") REFERENCES "public"."professor_quiz_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assessment_questions_discipline" ON "assessment_questions" USING btree ("discipline_id","archived_at");--> statement-breakpoint
CREATE INDEX "idx_assessment_questions_owner" ON "assessment_questions" USING btree ("owner_id","archived_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_assessment_questions_imported" ON "assessment_questions" USING btree ("owner_id","source_quiz_question_id") WHERE "assessment_questions"."archived_at" IS NULL AND "assessment_questions"."source_quiz_question_id" IS NOT NULL;