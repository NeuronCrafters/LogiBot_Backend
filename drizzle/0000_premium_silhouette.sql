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
CREATE TABLE "chat_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chat_session_id" uuid NOT NULL,
	"user_message_id" uuid NOT NULL,
	"assistant_message_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"provider" text,
	"retrieved_chunks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timings_ms" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"locked_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"detected_topic" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
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
CREATE TABLE "class_rag_settings" (
	"class_id" uuid PRIMARY KEY NOT NULL,
	"rag_mode" text DEFAULT 'none' NOT NULL,
	"top_k" integer DEFAULT 4 NOT NULL,
	"min_score" integer DEFAULT 40 NOT NULL,
	"system_prompt" text,
	"llm_model" text,
	"embedding_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"course_id" uuid NOT NULL,
	"registration_code" text NOT NULL,
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
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "professor_quiz_ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"professor_id" uuid NOT NULL,
	"class_id" uuid,
	"discipline_id" uuid NOT NULL,
	"theme" text NOT NULL,
	"question_count" integer NOT NULL,
	"selected_document_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"retrieved_chunk_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text,
	"model" text,
	"status" text DEFAULT 'done' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option" text NOT NULL,
	"is_correct" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quiz_question_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"chroma_id" text,
	"chunk_index" integer,
	"score" integer,
	"content_excerpt" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_option" text NOT NULL,
	"explanation" text,
	"order_index" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "professor_quizzes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professor_id" uuid NOT NULL,
	"discipline_id" uuid NOT NULL,
	"class_id" uuid,
	"generation_source" text DEFAULT 'manual' NOT NULL,
	"title" text NOT NULL,
	"topic" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE "rag_document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"chroma_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_document_chunks_chroma_id_unique" UNIQUE("chroma_id")
);
--> statement-breakpoint
CREATE TABLE "rag_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"title" text NOT NULL,
	"original_file_name" text NOT NULL,
	"stored_file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"extracted_text_path" text,
	"source_type" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" integer NOT NULL,
	"status" text DEFAULT 'uploaded' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rag_ingestion_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "chat_generation_jobs" ADD CONSTRAINT "chat_generation_jobs_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD CONSTRAINT "chat_generation_jobs_chat_session_id_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD CONSTRAINT "chat_generation_jobs_user_message_id_chat_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_generation_jobs" ADD CONSTRAINT "chat_generation_jobs_assistant_message_id_chat_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_session_id_chat_sessions_id_fk" FOREIGN KEY ("chat_session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_topic_counts" ADD CONSTRAINT "chat_topic_counts_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_disciplines" ADD CONSTRAINT "class_disciplines_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_disciplines" ADD CONSTRAINT "class_disciplines_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_rag_settings" ADD CONSTRAINT "class_rag_settings_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
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
ALTER TABLE "professor_quiz_ai_generations" ADD CONSTRAINT "professor_quiz_ai_generations_quiz_id_professor_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."professor_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_ai_generations" ADD CONSTRAINT "professor_quiz_ai_generations_professor_id_accounts_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_ai_generations" ADD CONSTRAINT "professor_quiz_ai_generations_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_ai_generations" ADD CONSTRAINT "professor_quiz_ai_generations_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_answers" ADD CONSTRAINT "professor_quiz_answers_attempt_id_professor_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."professor_quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_answers" ADD CONSTRAINT "professor_quiz_answers_question_id_professor_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."professor_quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_attempts" ADD CONSTRAINT "professor_quiz_attempts_quiz_id_professor_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."professor_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_attempts" ADD CONSTRAINT "professor_quiz_attempts_student_id_accounts_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_question_sources" ADD CONSTRAINT "professor_quiz_question_sources_question_id_professor_quiz_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."professor_quiz_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_question_sources" ADD CONSTRAINT "professor_quiz_question_sources_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quiz_questions" ADD CONSTRAINT "professor_quiz_questions_quiz_id_professor_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."professor_quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD CONSTRAINT "professor_quizzes_professor_id_accounts_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD CONSTRAINT "professor_quizzes_discipline_id_disciplines_id_fk" FOREIGN KEY ("discipline_id") REFERENCES "public"."disciplines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_quizzes" ADD CONSTRAINT "professor_quizzes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_students" ADD CONSTRAINT "professor_students_professor_id_accounts_id_fk" FOREIGN KEY ("professor_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professor_students" ADD CONSTRAINT "professor_students_student_id_accounts_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_question_attempts" ADD CONSTRAINT "quiz_question_attempts_quiz_session_id_quiz_sessions_id_fk" FOREIGN KEY ("quiz_session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_subject_counts" ADD CONSTRAINT "quiz_subject_counts_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_document_chunks" ADD CONSTRAINT "rag_document_chunks_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_document_chunks" ADD CONSTRAINT "rag_document_chunks_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_uploaded_by_accounts_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_ingestion_jobs" ADD CONSTRAINT "rag_ingestion_jobs_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_school_id_universities_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_analyses" ADD CONSTRAINT "user_analyses_user_id_accounts_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_analyses" ADD CONSTRAINT "user_analyses_school_id_universities_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."universities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_analyses" ADD CONSTRAINT "user_analyses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_analyses" ADD CONSTRAINT "user_analyses_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_generation_jobs_status_locked_created_idx" ON "chat_generation_jobs" USING btree ("status","locked_at","created_at");--> statement-breakpoint
CREATE INDEX "chat_generation_jobs_user_status_idx" ON "chat_generation_jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "chat_generation_jobs_session_status_idx" ON "chat_generation_jobs" USING btree ("chat_session_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "chat_sessions_user_session_idx" ON "chat_sessions" USING btree ("user_id","session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_name_course_idx" ON "classes" USING btree ("name","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "classes_registration_code_idx" ON "classes" USING btree ("registration_code");--> statement-breakpoint
CREATE UNIQUE INDEX "courses_name_university_idx" ON "courses" USING btree ("name","university_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disciplines_name_course_idx" ON "disciplines" USING btree ("name","course_id");--> statement-breakpoint
CREATE INDEX "idx_pqag_quiz_id" ON "professor_quiz_ai_generations" USING btree ("quiz_id");--> statement-breakpoint
CREATE INDEX "idx_pqqs_question_id" ON "professor_quiz_question_sources" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX "idx_pq_discipline_status_class" ON "professor_quizzes" USING btree ("discipline_id","status","class_id");--> statement-breakpoint
CREATE INDEX "idx_pq_class_id" ON "professor_quizzes" USING btree ("class_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rag_document_chunks_document_chunk_idx" ON "rag_document_chunks" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "rag_document_chunks_class_idx" ON "rag_document_chunks" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "rag_documents_class_status_deleted_idx" ON "rag_documents" USING btree ("class_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "rag_documents_uploaded_by_created_idx" ON "rag_documents" USING btree ("uploaded_by","created_at");--> statement-breakpoint
CREATE INDEX "rag_ingestion_jobs_status_locked_created_idx" ON "rag_ingestion_jobs" USING btree ("status","locked_at","created_at");--> statement-breakpoint
CREATE INDEX "rag_ingestion_jobs_document_idx" ON "rag_ingestion_jobs" USING btree ("document_id");