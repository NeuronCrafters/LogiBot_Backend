import type { RagChunk } from "./ragChunkingService";
import { getOrCreateRagCollection } from "./chromaService";

type ChunkMetadata = {
  documentId: string;
  classId: string;
  uploadedBy: string;
  sourceType: string;
  title: string;
  embeddingModel: string | null;
};

export function buildChromaId(documentId: string, chunkIndex: number) {
  return `${documentId}:${chunkIndex}`;
}

export async function upsertChunksIntoChroma(input: {
  chunks: RagChunk[];
  embeddings: number[][];
  metadata: ChunkMetadata;
}) {
  if (!input.chunks.length) return [];
  if (input.chunks.length !== input.embeddings.length) {
    throw new Error("quantidade de chunks e embeddings nao confere");
  }

  const collection = await getOrCreateRagCollection();
  const ids = input.chunks.map((chunk) =>
    buildChromaId(input.metadata.documentId, chunk.index),
  );

  await collection.upsert({
    ids,
    embeddings: input.embeddings,
    documents: input.chunks.map((chunk) => chunk.content),
    metadatas: input.chunks.map((chunk, index) => ({
      documentId: input.metadata.documentId,
      classId: input.metadata.classId,
      uploadedBy: input.metadata.uploadedBy,
      chunkId: ids[index],
      sourceType: input.metadata.sourceType,
      title: input.metadata.title,
      chunkIndex: chunk.index,
      embeddingModel: input.metadata.embeddingModel || "",
    })),
  });

  return ids;
}

export async function deleteChunksFromChroma(chromaIds: string[]) {
  if (!chromaIds.length) return;
  const collection = await getOrCreateRagCollection();
  await collection.delete({ ids: chromaIds });
}
