const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_OVERLAP = 180;
const MAX_CHUNKS_PER_DOCUMENT = 1000;

export type RagChunk = {
  index: number;
  content: string;
  tokenCount: number;
};

function normalizeText(text: string) {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function estimateTokenCount(text: string) {
  return Math.ceil(text.length / 4);
}

function findSplitPoint(text: string, target: number) {
  const slice = text.slice(0, target);
  const paragraph = slice.lastIndexOf("\n\n");
  if (paragraph >= target * 0.55) return paragraph + 2;

  const sentence = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("? "), slice.lastIndexOf("! "));
  if (sentence >= target * 0.55) return sentence + 2;

  const space = slice.lastIndexOf(" ");
  if (space >= target * 0.55) return space + 1;

  return target;
}

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number },
): RagChunk[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];

  const chunkSize = options?.chunkSize || DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(options?.overlap ?? DEFAULT_OVERLAP, chunkSize - 1);
  const chunks: RagChunk[] = [];
  let cursor = 0;

  while (cursor < normalized.length && chunks.length < MAX_CHUNKS_PER_DOCUMENT) {
    const remaining = normalized.slice(cursor);
    const split =
      remaining.length <= chunkSize
        ? remaining.length
        : findSplitPoint(remaining, chunkSize);
    const content = remaining.slice(0, split).trim();

    if (content) {
      chunks.push({
        index: chunks.length,
        content,
        tokenCount: estimateTokenCount(content),
      });
    }

    if (remaining.length <= chunkSize) break;
    cursor += Math.max(split - overlap, 1);
  }

  return chunks;
}
