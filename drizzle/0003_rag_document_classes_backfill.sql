-- Custom SQL migration file, put your code below! --
INSERT INTO rag_document_classes (document_id, class_id, enabled)
SELECT id, class_id, true
FROM rag_documents
WHERE deleted_at IS NULL
ON CONFLICT (document_id, class_id) DO NOTHING;
