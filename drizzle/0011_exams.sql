CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"question_id" uuid,
	"question_version" integer NOT NULL,
	"order_index" integer NOT NULL,
	"type" text NOT NULL,
	"weight" double precision NOT NULL,
	"snapshot" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exam_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"status" text DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone,
	"last_saved_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"submit_reason" text,
	"layout" jsonb NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"events" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"objective_results" jsonb,
	CONSTRAINT "exam_submissions_status_check" CHECK ("exam_submissions"."status" IN ('in_progress', 'submitted')),
	CONSTRAINT "exam_submissions_reason_check" CHECK ("exam_submissions"."submit_reason" IS NULL OR "exam_submissions"."submit_reason" IN ('student', 'time_limit', 'exam_closed'))
);
--> statement-breakpoint
CREATE TABLE "exams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	"class_id" uuid,
	"title" text NOT NULL,
	"instructions" text,
	"shuffle" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"opens_at" timestamp with time zone,
	"closes_at" timestamp with time zone,
	"time_limit_minutes" integer,
	"draft_question_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exams_status_check" CHECK ("exams"."status" IN ('draft', 'published', 'closed', 'released')),
	CONSTRAINT "exams_window_check" CHECK ("exams"."opens_at" IS NULL OR "exams"."closes_at" IS NULL OR "exams"."closes_at" > "exams"."opens_at"),
	CONSTRAINT "exams_time_limit_check" CHECK ("exams"."time_limit_minutes" IS NULL OR ("exams"."time_limit_minutes" >= 1 AND "exams"."time_limit_minutes" <= 600))
);
--> statement-breakpoint
ALTER TABLE "notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_question_id_assessment_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."assessment_questions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_submissions" ADD CONSTRAINT "exam_submissions_exam_id_exams_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_submissions" ADD CONSTRAINT "exam_submissions_student_id_accounts_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_owner_id_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exams" ADD CONSTRAINT "exams_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exam_questions_order" ON "exam_questions" USING btree ("exam_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exam_submissions_exam_student" ON "exam_submissions" USING btree ("exam_id","student_id");--> statement-breakpoint
CREATE INDEX "idx_exams_owner" ON "exams" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_exams_discipline_status" ON "exams" USING btree ("discipline_id","status");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("notifications"."type" IN ('quiz_published', 'quiz_completion_progress', 'exam_published', 'exam_submission_progress'));