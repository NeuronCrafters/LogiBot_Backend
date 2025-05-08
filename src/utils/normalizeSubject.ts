import { palavrasChaveConversa } from "@/utils/palavras-chave";

export function normalizeSubjectFromMessage(text: string): string | null {
  const msg = text.toLowerCase();
  for (const palavra of palavrasChaveConversa) {
    if (msg.includes(palavra)) {
      return "variavel";
    }
  }
  return null;
}
