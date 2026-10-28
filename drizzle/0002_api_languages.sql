ALTER TABLE "accounts" ADD COLUMN "preferred_language" text;
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_preferred_language_check" CHECK ("preferred_language" IS NULL OR "preferred_language" IN ('pt-BR', 'en-US', 'es-ES'));
--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD COLUMN "output_language" text DEFAULT 'pt-BR' NOT NULL;
--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD CONSTRAINT "chat_jobs_output_language_check" CHECK ("output_language" IN ('pt-BR', 'en-US', 'es-ES'));
--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD COLUMN "error_code" text;
--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD COLUMN "error_params" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD COLUMN "language" text;
--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD CONSTRAINT "professor_quizzes_language_check" CHECK ("language" IS NULL OR "language" IN ('pt-BR', 'en-US', 'es-ES'));
--> statement-breakpoint
ALTER TABLE "professor_quiz_ai_generations" ADD COLUMN "language" text;
--> statement-breakpoint
ALTER TABLE "professor_quiz_ai_generations" ADD CONSTRAINT "quiz_generations_language_check" CHECK ("language" IS NULL OR "language" IN ('pt-BR', 'en-US', 'es-ES'));
