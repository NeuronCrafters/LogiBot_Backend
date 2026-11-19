CREATE TABLE "exercise_hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"attempt_id" uuid NOT NULL,
	"exercise_id" text NOT NULL,
	"level" integer NOT NULL,
	"source" text NOT NULL,
	"used_material" boolean DEFAULT false NOT NULL,
	"text" text NOT NULL,
	"language" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_hints_level_check" CHECK ("exercise_hints"."level" BETWEEN 1 AND 3),
	CONSTRAINT "exercise_hints_source_check" CHECK ("exercise_hints"."source" IN ('ai', 'fallback'))
);
--> statement-breakpoint
ALTER TABLE "exercise_hints" ADD CONSTRAINT "exercise_hints_student_id_accounts_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_hints" ADD CONSTRAINT "exercise_hints_attempt_id_exercise_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exercise_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_exercise_hints_student_exercise_level" ON "exercise_hints" USING btree ("student_id","exercise_id","level");--> statement-breakpoint
CREATE INDEX "idx_exercise_hints_student_created" ON "exercise_hints" USING btree ("student_id","created_at");