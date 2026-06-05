CREATE TABLE "class_rag_settings" (
	"class_id" uuid PRIMARY KEY NOT NULL,
	"rag_mode" text DEFAULT 'none' NOT NULL,
	"top_k" integer DEFAULT 4 NOT NULL,
	"min_score" integer DEFAULT 60 NOT NULL,
	"system_prompt" text,
	"llm_model" text,
	"embedding_model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
ALTER TABLE "professor_quizzes" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE "class_rag_settings" ADD CONSTRAINT "class_rag_settings_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_document_chunks" ADD CONSTRAINT "rag_document_chunks_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_document_chunks" ADD CONSTRAINT "rag_document_chunks_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_documents" ADD CONSTRAINT "rag_documents_uploaded_by_accounts_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_ingestion_jobs" ADD CONSTRAINT "rag_ingestion_jobs_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rag_document_chunks_document_chunk_idx" ON "rag_document_chunks" USING btree ("document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "rag_document_chunks_class_idx" ON "rag_document_chunks" USING btree ("class_id");--> statement-breakpoint
CREATE INDEX "rag_documents_class_status_deleted_idx" ON "rag_documents" USING btree ("class_id","status","deleted_at");--> statement-breakpoint
CREATE INDEX "rag_documents_uploaded_by_created_idx" ON "rag_documents" USING btree ("uploaded_by","created_at");--> statement-breakpoint
CREATE INDEX "rag_ingestion_jobs_status_locked_created_idx" ON "rag_ingestion_jobs" USING btree ("status","locked_at","created_at");--> statement-breakpoint
CREATE INDEX "rag_ingestion_jobs_document_idx" ON "rag_ingestion_jobs" USING btree ("document_id");