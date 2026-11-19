CREATE TABLE "exercise_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"class_id" uuid,
	"discipline_id" uuid,
	"mode" text DEFAULT 'practice' NOT NULL,
	"exercise_type" text NOT NULL,
	"exercise_id" text NOT NULL,
	"exercise_version" integer DEFAULT 1 NOT NULL,
	"source" text NOT NULL,
	"subject" text NOT NULL,
	"concepts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"attempt_number" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"hints_used" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"engine_version" text NOT NULL,
	"submitted_state" jsonb NOT NULL,
	"result" jsonb NOT NULL,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_attempts_mode_check" CHECK ("exercise_attempts"."mode" IN ('practice', 'exam')),
	CONSTRAINT "exercise_attempts_type_check" CHECK ("exercise_attempts"."exercise_type" IN ('truth_table')),
	CONSTRAINT "exercise_attempts_source_check" CHECK ("exercise_attempts"."source" IN ('catalog', 'custom', 'bank')),
	CONSTRAINT "exercise_attempts_attempt_number_check" CHECK ("exercise_attempts"."attempt_number" >= 1),
	CONSTRAINT "exercise_attempts_hints_check" CHECK ("exercise_attempts"."hints_used" >= 0),
	CONSTRAINT "exercise_attempts_duration_check" CHECK ("exercise_attempts"."duration_ms" IS NULL OR "exercise_attempts"."duration_ms" >= 0)
);
--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_student_id_accounts_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_attempts" ADD CONSTRAINT "exercise_attempts_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_exercise_attempts_student_exercise" ON "exercise_attempts" USING btree ("student_id","exercise_id");--> statement-breakpoint
CREATE INDEX "idx_exercise_attempts_class_created" ON "exercise_attempts" USING btree ("class_id","created_at");