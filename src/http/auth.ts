import { logoutSession, validateSession } from "../services/auth/sessionLifecycleService";
import { sessionPolicy } from "../config/session";
import { accountLanguage } from "../i18n/middleware";
import { t } from "../i18n";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getAccountById } from "../db/repositories/authRepository";
import { getDb } from "../db/client";
import { AppError } from "../exceptions/AppError";
import type { Role } from "../types/Role";
import { assertInstitutionActiveFor } from "../services/institutions/institutionService";
import { clearAuthCookie } from "./cookies";

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new AppError({ key: "config.missingEnvironment", params: { value0: name } }, 500);
  return value;
}

export function signSession(claims: {
  id: string;
  sid: string;
  name: string;
  email: string;
  role: Role[];
  school?: string | null;
  /** Test environment sessions use the sandbox database. */
  env?: "production" | "sandbox";
}) {
  return jwt.sign(claims, requireEnv("JWT_SECRET"), {
    expiresIn: sessionPolicy().absoluteSeconds,
    subject: claims.id,
  });
}

export function normalizeRoles(
  roleField: string | string[] | null | undefined,
): Role[] {
  if (!roleField) return [];
  const roles = Array.isArray(roleField) ? roleField : [roleField];
  return roles.filter(Boolean) as Role[];
}

export function prioritizeRoles(roles: Role[]) {
  if (roles.includes("course-coordinator"))
    return ["course-coordinator"] as Role[];
  return roles;
}

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!process.env.API_KEY) return next();

  const providedKey = req.header("x-api-key") || req.header("X-API-Key");
  if (providedKey !== process.env.API_KEY) {
    return res
      .status(401)
      .json({ success: false, code: "auth.apiKeyInvalid", message: t("auth.apiKeyInvalid") });
  }

  return next();
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Already authenticated earlier in this request (e.g. by a feature gate).
  if (req.user) return next();
  const token = req.cookies?.token;
  if (!token) return next(new AppError("auth.tokenMissing", 401));

  try {
    const decoded = jwt.verify(
      token,
      requireEnv("JWT_SECRET"),
    ) as jwt.JwtPayload & {
      id?: string;
      sid?: string;
      role?: Role[] | Role;
    };

    const id = String(decoded.id || decoded.sub || "");
    if (!id) throw new AppError("auth.tokenInvalid", 401);
    if (!decoded.sid || !/^[0-9a-f-]{36}$/i.test(decoded.sid)) throw new AppError("auth.sessionExpired", 401);
    const session = await validateSession(getDb(), decoded.sid, id);
    req.authSessionId = session.id;
    req.analysisSessionId = session.analysisSessionId;
    req.sessionStatus = session;


    const account = await getAccountById(getDb(), id);
    if (!account) throw new AppError("auth.userNotFound", 401);
    accountLanguage(req, res, account.preferredLanguage);
    if (account.status !== "active")
      throw new AppError("auth.accountInactive", 403);
    await assertInstitutionActiveFor(getDb(), account);

    req.user = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: normalizeRoles(account.roles),
      school: account.schoolId || null,
      preferredLanguage: account.preferredLanguage,
      courses: account.courses?.length
        ? account.courses
        : account.courseId || null,
      classes: account.classes?.length
        ? account.classes
        : account.classId || null,
      disciplines: account.disciplines ?? [],
    };

    return next();
  } catch (error) {
    clearAuthCookie(req, res);
    if (error instanceof jwt.TokenExpiredError) {
      const expired = jwt.verify(token, requireEnv("JWT_SECRET"), { ignoreExpiration: true }) as jwt.JwtPayload;
      if (typeof expired.sid === "string" && typeof expired.sub === "string" && /^[0-9a-f-]{36}$/i.test(expired.sid))
        await logoutSession(getDb(), expired.sid, expired.sub, "absolute_timeout");
      return next(new AppError("auth.sessionExpired", 401));
    }
    if (error instanceof jwt.JsonWebTokenError)
      return next(new AppError("auth.tokenInvalid", 401));
    return next(error);
  }
}

export function requireRoles(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const roles = normalizeRoles(req.user?.role);
    if (!roles.some((role) => allowedRoles.includes(role))) {
      return next(new AppError("auth.accessDenied", 403));
    }
    return next();
  };
}
