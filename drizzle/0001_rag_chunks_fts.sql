-- Custom SQL migration file, put your code below! --
CREATE INDEX IF NOT EXISTS rag_document_chunks_content_fts_idx
  ON rag_document_chunks
  USING gin (to_tsvector('portuguese', content));
