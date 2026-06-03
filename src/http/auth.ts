import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { getAccountById } from "../db/repositories/authRepository";
import { getDb } from "../db/client";
import { AppError } from "../exceptions/AppError";
import type { Role } from "../types/Role";
import { clearAuthCookie } from "./cookies";

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new AppError(`${name} nao configurado`, 500);
  return value;
}

export function signSession(claims: {
  id: string;
  name: string;
  email: string;
  role: Role[];
  school?: string | null;
}) {
  return jwt.sign(claims, requireEnv("JWT_SECRET"), {
    expiresIn: "2h",
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
      .json({ success: false, message: "api key invalida" });
  }

  return next();
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.token;
  if (!token) return next(new AppError("nao autenticado: token ausente", 401));

  try {
    const decoded = jwt.verify(
      token,
      requireEnv("JWT_SECRET"),
    ) as jwt.JwtPayload & {
      id?: string;
      role?: Role[] | Role;
    };

    const id = String(decoded.id || decoded.sub || "");
    if (!id) throw new AppError("token invalido", 401);

    const account = await getAccountById(getDb(), id);
    if (!account) throw new AppError("usuario nao encontrado", 401);
    if (account.status !== "active")
      throw new AppError("acesso negado. sua conta esta inativa.", 403);

    req.user = {
      id: account.id,
      name: account.name,
      email: account.email,
      role: normalizeRoles(account.roles),
      school: account.schoolId || null,
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
    if (error instanceof jwt.JsonWebTokenError)
      return next(new AppError("token invalido", 401));
    return next(error);
  }
}

export function requireRoles(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const roles = normalizeRoles(req.user?.role);
    if (!roles.some((role) => allowedRoles.includes(role))) {
      return next(new AppError("acesso negado", 403));
    }
    return next();
  };
}
