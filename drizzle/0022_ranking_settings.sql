CREATE TABLE "ranking_settings" (
	"scope" text NOT NULL,
	"scope_id" text DEFAULT '' NOT NULL,
	"config" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ranking_settings_scope_scope_id_pk" PRIMARY KEY("scope","scope_id"),
	CONSTRAINT "ranking_settings_scope_check" CHECK ("ranking_settings"."scope" IN ('global', 'institution'))
);
--> statement-breakpoint
ALTER TABLE "ranking_settings" ADD CONSTRAINT "ranking_settings_updated_by_accounts_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;