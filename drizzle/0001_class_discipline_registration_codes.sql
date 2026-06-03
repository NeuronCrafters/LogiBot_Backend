ALTER TABLE "class_disciplines" ADD COLUMN "code" text;--> statement-breakpoint
UPDATE "class_disciplines"
SET "code" = upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
WHERE "code" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "class_disciplines_code_idx" ON "class_disciplines" USING btree ("code");--> statement-breakpoint
