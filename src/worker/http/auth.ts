import type { MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { getAccountById } from "../../db/repositories/authRepository";
import { getDb } from "../db/client";
import { HttpError } from "../errors";
import { clearAuthCookie } from "../security/cookies";
import { verifySession } from "../security/jwt";
import type { AppBindings, Role } from "../types";

export const requireApiKey: MiddlewareHandler<AppBindings> = async (c, next) => {
  if (!c.env.API_KEY) return next();

  const providedKey = c.req.header("x-api-key") || c.req.header("X-API-Key");
  if (providedKey !== c.env.API_KEY) {
    throw new HttpError("api key invalida", 401);
  }

  return next();
};

export const requireAuth: MiddlewareHandler<AppBindings> = async (c, next) => {
  const token = getCookie(c, "token");
  if (!token) {
    throw new HttpError("nao autenticado: token ausente", 401);
  }

  try {
    const claims = await verifySession(token, c.env);
    if (!claims.id) {
      throw new HttpError("token invalido", 401);
    }

    const db = getDb(c.env);
    const document = await getAccountById(db, claims.id);

    if (!document) {
      throw new HttpError("usuario nao encontrado", 401);
    }

    if (document.status && document.status !== "active") {
      throw new HttpError("acesso negado. sua conta esta inativa.", 403);
    }

    c.set("user", {
      id: document.id,
      name: document.name,
      email: document.email,
      role: document.roles,
      school: document.schoolId || null,
      courses: document.courses?.length ? document.courses : document.courseId || null,
      classes: document.classes?.length ? document.classes : document.classId || null,
    });

    return next();
  } catch (error) {
    clearAuthCookie(c);
    throw error;
  }
};

export function requireRoles(allowedRoles: Role[]): MiddlewareHandler<AppBindings> {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw new HttpError("nao autenticado", 401);

    if (!user.role.some((role) => allowedRoles.includes(role))) {
      throw new HttpError("acesso negado", 403);
    }

    return next();
  };
}
