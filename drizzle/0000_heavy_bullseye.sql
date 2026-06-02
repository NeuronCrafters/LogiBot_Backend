CREATE TABLE "account_roles" (
	"account_id" uuid NOT NULL,
	"role" text NOT NULL,
	CONSTRAINT "account_roles_account_id_role_pk" PRIMARY KEY("account_id","role")
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"status" text DEFAULT 'active' NOT NULL,
	"photo" text,
	"reset_password_token" text,
	"reset_password_expires" timestamp with time zone,
	"last_feedback_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "analysis_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"session_start" timestamp with time zone DEFAULT now() NOT NULL,
	"session_end" timestamp with time zone,
	"session_duration" integer DEFAULT 0 NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_correct_answers" integer DEFAULT 0 NOT NULL,
	"total_wrong_answers" integer DEFAULT 0 NOT NULL,
	"subject_counts_chat" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answer_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"total_correct_answers" integer DEFAULT 0 NOT NULL,
	"total_wrong_answers" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answer_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"level" text NOT NULL,
	"subject" text NOT NULL,
	"question" text NOT NULL,
	"selected_option" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"explanation" text,
	"total_correct_answers" integer DEFAULT 0 NOT NULL,
	"total_wrong_answers" integer DEFAULT 0 NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"detected_topic" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" text NOT NULL,
	"title" text DEFAULT 'Nova Conversa' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_topic_counts" (
	"user_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "chat_topic_counts_user_id_topic_pk" PRIMARY KEY("user_id","topic")
);
--> statement-breakpoint
CREATE TABLE "class_disciplines" (
	"class_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	CONSTRAINT "class_disciplines_class_id_discipline_id_pk" PRIMARY KEY("class_id","discipline_id")
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"course_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"university_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disciplines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"course_id" uuid NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "disciplines_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"type" text DEFAULT 'general' NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"hash" text NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_by_subject" (
	"analysis_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"correct" integer DEFAULT 0 NOT NULL,
	"wrong" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "performance_by_subject_analysis_id_subject_pk" PRIMARY KEY("analysis_id","subject")
);
--> statement-breakpoint
CREATE TABLE "professor_classes" (
	"professor_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	CONSTRAINT "professor_classes_professor_id_class_id_pk" PRIMARY KEY("professor_id","class_id")
);
--> statement-breakpoint
CREATE TABLE "professor_courses" (
	"professor_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	CONSTRAINT "professor_courses_professor_id_course_id_pk" PRIMARY KEY("professor_id","course_id")
);
--> statement-breakpoint
CREATE TABLE "professor_disciplines" (
	"professor_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	CONSTRAINT "professor_disciplines_professor_id_discipline_id_pk" PRIMARY KEY("professor_id","discipline_id")
);
--> statement-breakpoint
CREATE TABLE "professor_profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_students" (
	"professor_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	CONSTRAINT "professor_students_professor_id_student_id_pk" PRIMARY KEY("professor_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "quiz_question_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_session_id" uuid NOT NULL,
	"question" text NOT NULL,
	"selected_option" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"subject" text NOT NULL,
	"level" text,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_id" text NOT NULL,
	"title" text DEFAULT 'Quiz Pratico' NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_subject_counts" (
	"user_id" uuid NOT NULL,
	"subject" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "quiz_subject_counts_user_id_subject_pk" PRIMARY KEY("user_id","subject")
);
--> statement-breakpoint
CREATE TABLE "student_disciplines" (
	"student_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	CONSTRAINT "student_disciplines_student_id_discipline_id_pk" PRIMARY KEY("student_id","discipline_id")
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"school_id" uuid NOT NULL,
	"course_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"level" text DEFAULT 'desconhecido' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "universities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"school_id" uuid NOT NULL,
	"school_name" text NOT NULL,
	"course_id" uuid NOT NULL,
	"course_name" text NOT NULL,
	"class_id" uuid NOT NULL,
	"class_name" text NOT NULL,
	"total_usage_time" integer DEFAULT 0 NOT NULL,
	"total_correct_answers" integer DEFAULT 0 NOT NULL,
	"total_wrong_answers" integer DEFAULT 0 NOT NULL,
	"subject_counts_quiz" jsonb DEFAULT '{}'::jsonb NOT NULL,
	CONSTRAINT "user_analyses_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "user_analyses_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysis_sessions" ADD CONSTRAINT "analysis_sessions_analysis_id_user_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."user_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_attempts" ADD CONSTRAINT "answer_attempts_session_id_analysis_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."analysis_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_questions" ADD CONSTRAINT "answer_questions_attempt_id_answer_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."answer_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_session_id_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_topic_counts" ADD CONSTRAINT "chat_topic_counts_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_disciplines" ADD CONSTRAINT "class_disciplines_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_disciplines" ADD CONSTRAINT "class_disciplines_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "courses" ADD CONSTRAINT "courses_university_id_universities_id_fk" FOREIGN KEY ("university_id") REFERENCES "public"."universities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disciplines" ADD CONSTRAINT "disciplines_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_history" ADD CONSTRAINT "password_history_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_by_subject" ADD CONSTRAINT "performance_by_subject_analysis_id_user_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."user_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_classes" ADD CONSTRAINT "professor_classes_professor_id_accounts_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_classes" ADD CONSTRAINT "professor_classes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_courses" ADD CONSTRAINT "professor_courses_professor_id_accounts_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_courses" ADD CONSTRAINT "professor_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_disciplines" ADD CONSTRAINT "professor_disciplines_professor_id_accounts_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_disciplines" ADD CONSTRAINT "professor_disciplines_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_profiles" ADD CONSTRAINT "professor_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_profiles" ADD CONSTRAINT "professor_profiles_school_id_universities_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_students" ADD CONSTRAINT "professor_students_professor_id_accounts_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_students" ADD CONSTRAINT "professor_students_student_id_accounts_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question_attempts" ADD CONSTRAINT "quiz_question_attempts_quiz_session_id_quiz_sessions_id_fk" FOREIGN KEY ("quiz_session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_subject_counts" ADD CONSTRAINT "quiz_subject_counts_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_disciplines" ADD CONSTRAINT "student_disciplines_student_id_accounts_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_disciplines" ADD CONSTRAINT "student_disciplines_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_school_id_universities_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_analyses" ADD CONSTRAINT "user_analyses_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_analyses" ADD CONSTRAINT "user_analyses_school_id_universities_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_analyses" ADD CONSTRAINT "user_analyses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_analyses" ADD CONSTRAINT "user_analyses_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_sessions_user_session_idx" ON "chat_sessions" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_name_course_idx" ON "classes" USING btree ("name","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_name_university_idx" ON "courses" USING btree ("name","university_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disciplines_name_course_idx" ON "disciplines" USING btree ("name","course_id");
