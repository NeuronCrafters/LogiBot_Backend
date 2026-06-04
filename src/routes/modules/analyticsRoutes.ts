import { Router } from "express";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth } from "../../http/auth";
import { getDb } from "../../db/client";
import { analysisSessions, userAnalyses } from "../../db/schema";
import { normalizeSubjectFromMessage } from "../../utils/normalizeSubject";

export const analyticsRouter = Router();

analyticsRouter.use(requireAuth);

analyticsRouter.post(
  "/interaction",
  asyncHandler(async (req, res) => {
    const message = String(req.body.message || "");
    const category = normalizeSubjectFromMessage(message.trim());
    if (!category) return res.json({ success: true });
    const [analysis] = await getDb()
      .select()
      .from(userAnalyses)
      .where(eq(userAnalyses.userId, req.user!.id))
      .limit(1);
    if (!analysis) return res.json({ success: true });
    const [session] = await getDb()
      .select()
      .from(analysisSessions)
      .where(
        and(
          eq(analysisSessions.analysisId, analysis.id),
          isNull(analysisSessions.sessionEnd),
        ),
      )
      .orderBy(desc(analysisSessions.sessionStart))
      .limit(1);
    if (!session) return res.json({ success: true });
    await getDb()
      .update(analysisSessions)
      .set({
        subjectCountsChat: sql`jsonb_set(COALESCE(${analysisSessions.subjectCountsChat}, '{}')::jsonb, ARRAY[${category}], to_jsonb(COALESCE((${analysisSessions.subjectCountsChat}->>${category})::integer, 0) + 1))`,
        lastActivityAt: new Date(),
      })
      .where(eq(analysisSessions.id, session.id));
    return res.json({ success: true });
  }),
);

analyticsRouter.post(
  "/subject-clicks",
  asyncHandler(async (req, res) => {
    const clicks = req.body.clicks as Record<string, number> | undefined;
    if (!clicks || typeof clicks !== "object")
      return res.json({
        message: "Cliques de categoria contabilizados com sucesso.",
      });
    const [analysis] = await getDb()
      .select()
      .from(userAnalyses)
      .where(eq(userAnalyses.userId, req.user!.id))
      .limit(1);
    if (!analysis)
      return res.json({
        message: "Cliques de categoria contabilizados com sucesso.",
      });
    const current = {
      ...((analysis.subjectCountsQuiz as Record<string, number>) || {}),
    };
    for (const [raw, count] of Object.entries(clicks)) {
      const category = normalizeSubjectFromMessage(raw) || "tipos";
      current[category] = (current[category] || 0) + Number(count || 0);
    }
    await getDb()
      .update(userAnalyses)
      .set({ subjectCountsQuiz: current })
      .where(eq(userAnalyses.id, analysis.id));
    return res.json({
      message: "Cliques de categoria contabilizados com sucesso.",
    });
  }),
);
