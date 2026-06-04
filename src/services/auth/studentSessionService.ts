import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../../db/client";
import { analysisSessions, userAnalyses } from "../../db/schema";

export async function closeOpenStudentSession(userId: string) {
  const db = getDb();
  const [analysis] = await db
    .select()
    .from(userAnalyses)
    .where(eq(userAnalyses.userId, userId))
    .limit(1);
  if (!analysis) return;

  const [session] = await db
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

  if (!session) return;
  const end = new Date();
  const duration = Math.floor(
    (end.getTime() - new Date(session.sessionStart).getTime()) / 1000,
  );
  await db
    .update(analysisSessions)
    .set({ sessionEnd: end, sessionDuration: duration, lastActivityAt: end })
    .where(eq(analysisSessions.id, session.id));
  await db
    .update(userAnalyses)
    .set({ totalUsageTime: analysis.totalUsageTime + duration })
    .where(eq(userAnalyses.id, analysis.id));
}
