CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"analysis_session_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checkpoint_at" timestamp with time zone DEFAULT now() NOT NULL,
	"idle_expires_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"end_reason" text
);
--> statement-breakpoint
CREATE TABLE "session_activity_intervals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_session_id" uuid NOT NULL,
	"analysis_session_id" uuid NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone NOT NULL,
	CONSTRAINT "session_activity_intervals_valid" CHECK ("session_activity_intervals"."ended_at" > "session_activity_intervals"."started_at" AND "session_activity_intervals"."ended_at" <= "session_activity_intervals"."started_at" + interval '60 seconds')
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_analysis_session_id_analysis_sessions_id_fk" FOREIGN KEY ("analysis_session_id") REFERENCES "public"."analysis_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_activity_intervals" ADD CONSTRAINT "session_activity_intervals_auth_session_id_auth_sessions_id_fk" FOREIGN KEY ("auth_session_id") REFERENCES "public"."auth_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_activity_intervals" ADD CONSTRAINT "session_activity_intervals_analysis_session_id_analysis_sessions_id_fk" FOREIGN KEY ("analysis_session_id") REFERENCES "public"."analysis_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "auth_sessions_live_account" ON "auth_sessions" USING btree ("account_id") WHERE "auth_sessions"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "auth_sessions_expiry" ON "auth_sessions" USING btree ("idle_expires_at","expires_at") WHERE "auth_sessions"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX "session_activity_intervals_analysis" ON "session_activity_intervals" USING btree ("analysis_session_id");