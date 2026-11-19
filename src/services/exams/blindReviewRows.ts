import { randomInt } from "crypto";
import { and, eq } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { blindReviews, examQuestions, examSubmissions } from "../../db/schema";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const randomCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");

/**
 * Creates the anonymous review rows of a submitted attempt (one per essay). Codes are
 * random per question; the display order is random and fixed from now on.
 */
export async function createBlindReviewsFor(db: AnyDbClient, submissionId: string) {
  const [submission] = await db.select().from(examSubmissions).where(eq(examSubmissions.id, submissionId)).limit(1);
  if (!submission || submission.status !== "submitted") return;
  const essays = await db.select({ id: examQuestions.id }).from(examQuestions)
    .where(and(eq(examQuestions.examId, submission.examId), eq(examQuestions.type, "essay")));
  for (const essay of essays) {
    for (let tries = 0; tries < 20; tries++) {
      const created = await db.insert(blindReviews)
        .values({ submissionId, examQuestionId: essay.id, code: randomCode(), displayOrder: randomInt(1, 2 ** 47) / 2 ** 47 })
        .onConflictDoNothing()
        .returning({ id: blindReviews.id });
      if (created.length) break;
      const [existing] = await db.select({ id: blindReviews.id }).from(blindReviews)
        .where(and(eq(blindReviews.submissionId, submissionId), eq(blindReviews.examQuestionId, essay.id))).limit(1);
      if (existing) break; // already created; otherwise the code collided: try another one
    }
  }
}

