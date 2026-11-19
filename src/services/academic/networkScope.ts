import type { Request } from "express";
import { eq } from "drizzle-orm";
import type { AnyDbClient } from "../../db/client";
import { classes, courses, disciplines } from "../../db/schema";
import { AppError } from "../../exceptions/AppError";

type NetworkUser = Pick<NonNullable<Request["user"]>, "role" | "school">;

/**
 * Each profile only sees the institution it belongs to. Admins see the whole database they are in
 * (test admins only reach the separate test database).
 */
export const seesEveryNetwork = (user: NetworkUser) => user.role.includes("admin");

/** Institution of a non-admin profile; without one there is nothing to list. */
export function requireNetwork(user: NetworkUser): string {
  if (typeof user.school === "string" && user.school) return user.school;
  throw new AppError("auth.accessDeniedCapital", 403);
}

async function courseInstitution(db: AnyDbClient, courseId: string) {
  const [row] = await db.select({ universityId: courses.universityId }).from(courses).where(eq(courses.id, courseId)).limit(1);
  return row?.universityId ?? null;
}

/** Not found and outside the network look the same, so other institutions are not revealed. */
export async function assertCourseInNetwork(db: AnyDbClient, user: NetworkUser, courseId: string) {
  if (seesEveryNetwork(user)) return;
  const network = requireNetwork(user);
  if (!/^[0-9a-f-]{36}$/i.test(courseId) || (await courseInstitution(db, courseId)) !== network) throw new AppError("academic.notFound", 404);
}

export async function assertClassInNetwork(db: AnyDbClient, user: NetworkUser, classId: string) {
  if (seesEveryNetwork(user)) return;
  const network = requireNetwork(user);
  if (!/^[0-9a-f-]{36}$/i.test(classId)) throw new AppError("academic.notFound", 404);
  const [row] = await db.select({ courseId: classes.courseId }).from(classes).where(eq(classes.id, classId)).limit(1);
  if (!row || (await courseInstitution(db, row.courseId)) !== network) throw new AppError("academic.notFound", 404);
}

export async function assertDisciplineInNetwork(db: AnyDbClient, user: NetworkUser, disciplineId: string) {
  if (seesEveryNetwork(user)) return;
  const network = requireNetwork(user);
  if (!/^[0-9a-f-]{36}$/i.test(disciplineId)) throw new AppError("academic.notFound", 404);
  const [row] = await db.select({ courseId: disciplines.courseId }).from(disciplines).where(eq(disciplines.id, disciplineId)).limit(1);
  if (!row || (await courseInstitution(db, row.courseId)) !== network) throw new AppError("academic.notFound", 404);
}
