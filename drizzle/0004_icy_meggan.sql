CREATE TABLE "professor_quiz_disciplines" (
	"quiz_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "professor_quiz_disciplines_quiz_id_discipline_id_pk" PRIMARY KEY("quiz_id","discipline_id")
);
--> statement-breakpoint
ALTER TABLE "professor_quiz_disciplines" ADD CONSTRAINT "professor_quiz_disciplines_quiz_id_professor_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."professor_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_disciplines" ADD CONSTRAINT "professor_quiz_disciplines_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "professor_quiz_disciplines_discipline_idx" ON "professor_quiz_disciplines" USING btree ("discipline_id");