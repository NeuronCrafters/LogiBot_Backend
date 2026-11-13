CREATE TABLE "analysis_session_recoveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"previous_state" jsonb NOT NULL,
	"evidence" jsonb NOT NULL,
	"estimated_end" timestamp with time zone NOT NULL,
	"estimated_duration" integer NOT NULL,
	"backup_sha256" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analysis_sessions" ADD COLUMN "duration_source" text DEFAULT 'recorded' NOT NULL;--> statement-breakpoint
ALTER TABLE "analysis_session_recoveries" ADD CONSTRAINT "analysis_session_recoveries_session_id_analysis_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."analysis_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "analysis_session_recoveries_session_unique" ON "analysis_session_recoveries" USING btree ("session_id");