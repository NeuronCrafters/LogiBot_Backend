import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "../../db/client";
import { chatMessages, chatSessions } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";
import { getLanguage, t } from "../../i18n";
import { askOpenRouter } from "../ai/openRouterService";
import { activeChatMessage } from "./chatService";

const pending = new Map<string, Promise<string[]>>();

export function parseFollowUps(text: string): string[] {
  try {
    const parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
    const values = Array.isArray(parsed) ? parsed : parsed.suggestions;
    if (!Array.isArray(values)) return [];
    return [...new Set(values.filter((value): value is string => typeof value === "string")
      .map(value => value.trim()).filter(value => value.length > 0 && value.length <= 180))].slice(0, 3);
  } catch { return []; }
}

export async function getChatFollowUps(input: { userId: string; sessionId: string; messageId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(input.messageId)) throw new AppError("chat.editNotFound", 404);
  const db = getDb();
  const rows = await db.select({ id: chatMessages.id, role: chatMessages.role, content: chatMessages.content, metadata: chatMessages.metadata })
    .from(chatMessages).innerJoin(chatSessions, eq(chatSessions.id, chatMessages.chatSessionId))
    .where(and(eq(chatSessions.userId, input.userId), eq(chatSessions.sessionId, input.sessionId), activeChatMessage))
    .orderBy(desc(chatMessages.timestamp), desc(chatMessages.id)).limit(6);
  const answer = rows[0];
  if (!answer || answer.role !== "assistant" || answer.id !== input.messageId) return { messageId: input.messageId, suggestions: [] };
  const language = getLanguage();
  const metadata = answer.metadata as { followUps?: Partial<Record<typeof language, string[]>> };
  const cached = metadata.followUps?.[language];
  if (Array.isArray(cached) && cached.length) return { messageId: answer.id, suggestions: cached };
  const key = `${input.userId}:${answer.id}:${language}`;
  let work = pending.get(key);
  if (!work) {
    work = (async () => {
      let suggestions: string[] = [];
      try {
        const result = await askOpenRouter([
          { role: "system", content: t("chat.followUpSystem") },
          { role: "user", content: JSON.stringify(rows.slice().reverse().map(({ role, content }) => ({ role, content: content.slice(-6000) }))) },
        ], { includeChatPrompt: false, timeoutMs: 12000, queueTimeoutMs: 2000 });
        suggestions = parseFollowUps(result?.text || "");
      } catch { /* Suggestions must never prevent reading or continuing the chat. */ }
      const previous = new Set(rows.filter(row => row.role === "user").map(row => row.content.trim().toLocaleLowerCase()));
      suggestions = suggestions.filter(value => !previous.has(value.toLocaleLowerCase()));
      if (!suggestions.length) suggestions = [t("chat.followUpExample"), t("chat.followUpPractice"), t("chat.followUpRelated")];
      await db.update(chatMessages).set({
        metadata: sql`jsonb_set(${chatMessages.metadata}, '{followUps}', coalesce(${chatMessages.metadata}->'followUps', '{}'::jsonb) || ${JSON.stringify({ [language]: suggestions })}::jsonb)`,
      }).where(and(eq(chatMessages.id, answer.id), activeChatMessage));
      return suggestions;
    })();
    pending.set(key, work);
    void work.finally(() => pending.delete(key)).catch(() => {});
  }
  return { messageId: answer.id, suggestions: await work };
}
