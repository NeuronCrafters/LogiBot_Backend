import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { analysisSessions, userAnalyses } from "../../db/schema";
import { normalizeSubjectFromMessage } from "../../utils/normalizeSubject";
import { getDb } from "../db/client";
import { HttpError } from "../errors";
import { requireAuth } from "../http/auth";
import type { AppBindings } from "../types";

export const useranalysisRoutes = new Hono<AppBindings>();

useranalysisRoutes.use("/useranalysis/*", requireAuth);

useranalysisRoutes.post("/useranalysis/interaction", async (c) => {
  const { message } = await c.req.json<{ message?: string }>();
  const user = c.get("user")!;

  if (!message || !message.trim()) throw new HttpError("campo message e obrigatorio", 400);

  const category = normalizeSubjectFromMessage(message.trim());
  if (!category) return c.json({ success: true });

  const db = getDb(c.env);

  const [analysis] = await db
    .select()
    .from(userAnalyses)
    .where(eq(userAnalyses.userId, user.id))
    .limit(1);

  if (!analysis) return c.json({ success: true });

  const [session] = await db
    .select()
    .from(analysisSessions)
    .where(and(eq(analysisSessions.analysisId, analysis.id), isNull(analysisSessions.sessionEnd)))
    .orderBy(desc(analysisSessions.sessionStart))
    .limit(1);

  if (!session) return c.json({ success: true });

  await db
    .update(analysisSessions)
    .set({
      subjectCountsChat: sql`jsonb_set(
        COALESCE(${analysisSessions.subjectCountsChat}, '{}')::jsonb,
        ARRAY[${category}],
        to_jsonb(COALESCE((${analysisSessions.subjectCountsChat}->>${category})::integer, 0) + 1)
      )`,
      lastActivityAt: new Date(),
    })
    .where(eq(analysisSessions.id, session.id));

  return c.json({ success: true });
});

useranalysisRoutes.post("/useranalysis/subject-clicks", async (c) => {
  const { clicks } = await c.req.json<{ userId?: string; clicks?: Record<string, number> }>();
  const user = c.get("user")!;

  if (!clicks || typeof clicks !== "object") throw new HttpError("payload invalido", 400);

  const normalized: Record<string, number> = {};
  for (const [raw, count] of Object.entries(clicks)) {
    const cat = normalizeSubjectFromMessage(raw) || "tipos";
    normalized[cat] = (normalized[cat] || 0) + (count as number);
  }

  const db = getDb(c.env);

  const [analysis] = await db
    .select()
    .from(userAnalyses)
    .where(eq(userAnalyses.userId, user.id))
    .limit(1);

  if (!analysis) return c.json({ message: "Cliques de categoria contabilizados com sucesso." });

  const current = ((analysis.subjectCountsQuiz as Record<string, number>) || {});
  for (const [cat, count] of Object.entries(normalized)) {
    current[cat] = (current[cat] || 0) + count;
  }

  await db
    .update(userAnalyses)
    .set({ subjectCountsQuiz: current })
    .where(eq(userAnalyses.id, analysis.id));

  return c.json({ message: "Cliques de categoria contabilizados com sucesso." });
});
