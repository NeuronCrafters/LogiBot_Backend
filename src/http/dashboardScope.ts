import type { NextFunction, Request, Response } from "express";
import { AppError } from "../exceptions/AppError";
import type { Filters } from "../services/analytics/analyticsService";
import { assertDashboardScopeAccess } from "../services/dashboard/dashboardPermissionService";

/**
 * Every Dashboard and analytics read goes through the same rule: the selection must belong to the
 * person asking (admins see their whole database; coordinators their courses; professors their
 * classes and disciplines). Ids are validated so a typo never becomes a server error.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_KEYS = ["universityId", "courseId", "classId", "studentId", "disciplineId"] as const;

export function parseScopeFilters(value: unknown): Filters {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AppError("insights.filtersObjectRequired", 400);
  const raw = value as Record<string, unknown>;
  const filters: Filters = {};
  for (const key of ID_KEYS) {
    if (raw[key] === undefined || raw[key] === null || raw[key] === "") continue;
    if (typeof raw[key] !== "string" || !UUID.test(raw[key] as string)) throw new AppError({ key: "validation.fieldInvalid", params: { value0: key } }, 400);
    filters[key] = raw[key] as string;
  }
  for (const key of ["startDate", "endDate"] as const) {
    if (raw[key] === undefined || raw[key] === null || raw[key] === "") continue;
    if (typeof raw[key] !== "string" || Number.isNaN(new Date(raw[key] as string).getTime())) throw new AppError({ key: "validation.fieldInvalid", params: { value0: key } }, 400);
    filters[key] = raw[key] as string;
  }
  return filters;
}

const ENTITY_KEY: Record<string, (typeof ID_KEYS)[number]> = {
  university: "universityId", universities: "universityId",
  course: "courseId", courses: "courseId",
  class: "classId", classes: "classId",
  discipline: "disciplineId", disciplines: "disciplineId",
  student: "studentId", students: "studentId",
};

/** Selection named in the URL (/logs/:entity/:id/...). */
export function entityFilters(entity: string, id: string): Filters {
  const key = ENTITY_KEY[entity];
  if (!key) throw new AppError("analytics.entityInvalid", 400);
  return parseScopeFilters({ [key]: id });
}

/** Middleware: checks the selection, then keeps the validated filters in `res.locals.scope`. */
export function requireDashboardScope(read: (req: Request) => Filters) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = read(req);
      await assertDashboardScopeAccess(req.user!, filters);
      res.locals.scope = filters;
      next();
    } catch (error) {
      next(error);
    }
  };
}
