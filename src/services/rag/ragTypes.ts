export type RagMode = "none" | "context" | "self" | "hybrid";

export type RagDocumentStatus =
  | "uploaded"
  | "processing"
  | "ready"
  | "error"
  | "deleted";

export type RagUser = {
  id: string;
  role: string[];
  courses?: string[] | string | null;
  classes?: string[] | string | null;
  disciplines?: string[];
};

export function toArray(value?: string[] | string | null) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
