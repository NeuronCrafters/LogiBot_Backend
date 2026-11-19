CREATE TABLE "feature_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature" text NOT NULL,
	"scope" text NOT NULL,
	"scope_id" text DEFAULT '' NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feature_rules_scope_check" CHECK ("feature_rules"."scope" IN ('global', 'institution', 'course', 'class'))
);
--> statement-breakpoint
ALTER TABLE "feature_rules" ADD CONSTRAINT "feature_rules_updated_by_accounts_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_feature_rules_feature_scope" ON "feature_rules" USING btree ("feature","scope","scope_id");