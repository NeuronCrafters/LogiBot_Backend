CREATE TABLE "feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option" text NOT NULL,
	"is_correct" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_option" text NOT NULL,
	"explanation" text,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professor_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	"title" text NOT NULL,
	"topic" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_disciplines" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "student_disciplines" CASCADE;--> statement-breakpoint
ALTER TABLE "disciplines" DROP CONSTRAINT "disciplines_code_unique";--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "registration_code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_answers" ADD CONSTRAINT "professor_quiz_answers_attempt_id_professor_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."professor_quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_answers" ADD CONSTRAINT "professor_quiz_answers_question_id_professor_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."professor_quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_attempts" ADD CONSTRAINT "professor_quiz_attempts_quiz_id_professor_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."professor_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_attempts" ADD CONSTRAINT "professor_quiz_attempts_student_id_accounts_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_questions" ADD CONSTRAINT "professor_quiz_questions_quiz_id_professor_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."professor_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD CONSTRAINT "professor_quizzes_professor_id_accounts_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD CONSTRAINT "professor_quizzes_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "classes_registration_code_idx" ON "classes" USING btree ("registration_code");--> statement-breakpoint
ALTER TABLE "disciplines" DROP COLUMN "code";