CREATE TABLE "institution_profiles" (
	"university_id" uuid PRIMARY KEY NOT NULL,
	"kind" text,
	"city" text,
	"state" text,
	"country" text,
	"website" text,
	"about" text,
	"logo" text,
	"cover" text,
	"active" boolean DEFAULT true NOT NULL,
	"deactivated_at" timestamp with time zone,
	"deactivated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "institution_profiles" ADD CONSTRAINT "institution_profiles_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution_profiles" ADD CONSTRAINT "institution_profiles_deactivated_by_accounts_id_fk" FOREIGN KEY ("deactivated_by") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;