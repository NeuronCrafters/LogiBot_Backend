ALTER TABLE "class_rag_settings" ALTER COLUMN "min_score" SET DEFAULT 40;--> statement-breakpoint
UPDATE "class_rag_settings" SET "min_score" = 40 WHERE "min_score" = 60;
