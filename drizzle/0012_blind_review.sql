CREATE TABLE "blind_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"exam_question_id" uuid NOT NULL,
	"code" text NOT NULL,
	"display_order" double precision NOT NULL,
	"score" double precision,
	"comment" text DEFAULT '' NOT NULL,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "blind_reviews_score_check" CHECK ("blind_reviews"."score" IS NULL OR "blind_reviews"."score" IN (0, 0.5, 1))
);
--> statement-breakpoint
CREATE TABLE "exam_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exam_audit_log_action_check" CHECK ("exam_audit_log"."action" IN ('review', 'release'))
);
--> statement-breakpoint
ALTER TABLE "exercise_attempts" DROP CONSTRAINT "exercise_attempts_type_check";--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "exam_submissions" ADD COLUMN "grade" double precision;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "released_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exams" ADD COLUMN "released_by" uuid;--> statement-breakpoint
ALTER TABLE "blind_reviews" ADD CONSTRAINT "blind_reviews_submission_id_exam_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."exam_submissions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_reviews" ADD CONSTRAINT "blind_reviews_exam_question_id_exam_questions_id_fk" FOREIGN KEY ("exam_question_id") REFERENCES "public"."exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blind_reviews" ADD CONSTRAINT "blind_reviews_reviewed_by_accounts_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_audit_log" ADD CONSTRAINT "exam_audit_log_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_audit_log" ADD CONSTRAINT "exam_audit_log_actor_id_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blind_reviews_question_code" ON "blind_reviews" USING btree ("exam_question_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_blind_reviews_submission_question" ON "blind_reviews" USING btree ("submission_id","exam_question_id");--> statement-breakpoint
CREATE INDEX "idx_exam_audit_log_exam" ON "exam_audit_log" USING btree ("exam_id","created_at");--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_released_by_accounts_id_fk" FOREIGN KEY ("released_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_type_check" CHECK ("exercise_attempts"."exercise_type" IN ('truth_table', 'translation', 'parsons', 'quiz', 'essay'));--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" IN ('quiz_published', 'quiz_completion_progress', 'exam_published', 'exam_submission_progress', 'exam_results_released'));