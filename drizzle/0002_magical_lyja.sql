CREATE TABLE "rag_document_classes" (
	"document_id" uuid NOT NULL,
	"class_id" uuid NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rag_document_classes_document_id_class_id_pk" PRIMARY KEY("document_id","class_id")
);
--> statement-breakpoint
ALTER TABLE "rag_document_classes" ADD CONSTRAINT "rag_document_classes_document_id_rag_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."rag_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rag_document_classes" ADD CONSTRAINT "rag_document_classes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rag_document_classes_class_idx" ON "rag_document_classes" USING btree ("class_id");