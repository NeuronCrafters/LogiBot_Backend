import { t } from "../../i18n";
import { Router } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { requireAuth, requireRoles } from "../../http/auth";
import { getDb } from "../../db/client";
import { accounts, classes, courses, feedbacks, professorProfiles, studentProfiles, universities } from "../../db/schema";

export const feedbackRouter = Router();

feedbackRouter.use(requireAuth);

feedbackRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const message = String(req.body.message || "").trim();
    const type = String(req.body.type || "general");
    if (!message) throw new AppError("feedback.messageRequired", 400);
    const [account] = await getDb()
      .select()
      .from(accounts)
      .where(eq(accounts.id, req.user!.id))
      .limit(1);
    if (!account) throw new AppError("feedback.userNotFound", 404);
    const isVip =
      req.user!.role.includes("admin") ||
      req.user!.role.includes("course-coordinator");
    if (!isVip && account.lastFeedbackAt) {
      const diffMinutes =
        (Date.now() - new Date(account.lastFeedbackAt).getTime()) / (1000 * 60);
      if (diffMinutes < 2)
        throw new AppError({ key: "feedback.wait", params: { value0: Math.ceil(2 - diffMinutes) } },
          429,
        );
    }
    await getDb()
      .insert(feedbacks)
      .values({ accountId: account.id, type, message });
    await getDb()
      .update(accounts)
      .set({ lastFeedbackAt: new Date(), updatedAt: new Date() })
      .where(eq(accounts.id, account.id));
    return res.json({ message: t("feedback.sent") });
  }),
);

feedbackRouter.get(
  "/",
  requireRoles(["admin"]),
  asyncHandler(async (_req, res) => {
    const rows = await getDb()
      .select({
        id: feedbacks.id,
        type: feedbacks.type,
        message: feedbacks.message,
        createdAt: feedbacks.createdAt,
        authorName: accounts.name,
        authorEmail: accounts.email,
        // Where the author belongs, so the list can be filtered by institution, course and class.
        studentSchoolId: studentProfiles.schoolId,
        courseId: studentProfiles.courseId,
        classId: studentProfiles.classId,
        professorSchoolId: professorProfiles.schoolId,
      })
      .from(feedbacks)
      .leftJoin(accounts, eq(feedbacks.accountId, accounts.id))
      .leftJoin(studentProfiles, eq(studentProfiles.accountId, feedbacks.accountId))
      .leftJoin(professorProfiles, eq(professorProfiles.accountId, feedbacks.accountId))
      .orderBy(desc(feedbacks.createdAt));

    const ids = (key: "school" | "course" | "class") => Array.from(new Set(rows.map((row) =>
      key === "school" ? row.studentSchoolId ?? row.professorSchoolId : key === "course" ? row.courseId : row.classId).filter((id): id is string => !!id)));
    const names = async (table: typeof universities | typeof courses | typeof classes, list: string[]) => {
      if (!list.length) return {} as Record<string, string>;
      const found = await getDb().select({ id: table.id, name: table.name }).from(table).where(inArray(table.id, list));
      return found.reduce((map, row) => { map[row.id] = row.name; return map; }, {} as Record<string, string>);
    };
    const [schoolNames, courseNames, classNames] = await Promise.all([names(universities, ids("school")), names(courses, ids("course")), names(classes, ids("class"))]);

    return res.json(rows.map(({ studentSchoolId, professorSchoolId, ...row }) => {
      const schoolId = studentSchoolId ?? professorSchoolId ?? null;
      return {
        ...row,
        schoolId,
        schoolName: schoolId ? schoolNames[schoolId] ?? null : null,
        courseName: row.courseId ? courseNames[row.courseId] ?? null : null,
        className: row.classId ? classNames[row.classId] ?? null : null,
      };
    }));
  }),
);
