ALTER TABLE "classes" ADD COLUMN "registration_code" text;--> statement-breakpoint
UPDATE "classes" AS c
SET "registration_code" = COALESCE(
  (
    SELECT cd."code"
    FROM "class_disciplines" cd
    WHERE cd."class_id" = c."id" AND cd."code" IS NOT NULL
    ORDER BY cd."code"
    LIMIT 1
  ),
  upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
)
WHERE c."registration_code" IS NULL;--> statement-breakpoint
ALTER TABLE "classes" ALTER COLUMN "registration_code" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "classes_registration_code_idx" ON "classes" USING btree ("registration_code");--> statement-breakpoint
DROP INDEX IF EXISTS "class_disciplines_code_idx";--> statement-breakpoint
ALTER TABLE "class_disciplines" DROP COLUMN IF EXISTS "code";--> statement-breakpoint
ALTER TABLE "disciplines" DROP CONSTRAINT IF EXISTS "disciplines_code_unique";--> statement-breakpoint
ALTER TABLE "disciplines" DROP COLUMN IF EXISTS "code";--> statement-breakpoint
DROP TABLE IF EXISTS "student_disciplines";--> statement-breakpoint
