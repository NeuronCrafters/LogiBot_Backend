import { eq } from "drizzle-orm";
import { getDb } from "../../db/client";
import { userAnalyses } from "../../db/schema";
import { closeAnalysisSession } from "../../db/repositories/studentSessionRepository";

export async function closeOpenStudentSession(userId: string) {
  const db = getDb();
  const [analysis] = await db.select({ id: userAnalyses.id }).from(userAnalyses)
    .where(eq(userAnalyses.userId, userId)).limit(1);
  if (analysis) await closeAnalysisSession(db, analysis.id);
}
