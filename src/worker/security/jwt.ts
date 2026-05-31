import { SignJWT, jwtVerify } from "jose";
import type { Env, Role } from "../types";

const encoder = new TextEncoder();

export interface SessionClaims {
  id: string;
  name: string;
  email: string;
  role: Role[];
  school?: string | null;
}

function secretKey(env: Env) {
  if (!env.JWT_SECRET) {
    throw new Error("JWT_SECRET nao configurado");
  }
  return encoder.encode(env.JWT_SECRET);
}

export async function signSession(claims: SessionClaims, env: Env) {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.id)
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(secretKey(env));
}

export async function verifySession(token: string, env: Env) {
  const { payload } = await jwtVerify(token, secretKey(env));
  return {
    id: String(payload.id || payload.sub || ""),
    name: String(payload.name || ""),
    email: String(payload.email || ""),
    role: normalizeRoles(payload.role as Role[] | Role | undefined),
    school: payload.school ? String(payload.school) : null,
  };
}

export function normalizeRoles(roleField: Role[] | Role | null | undefined): Role[] {
  if (!roleField) return [];
  if (Array.isArray(roleField)) return roleField.filter(Boolean);
  return [roleField];
}

export function prioritizeRoles(roles: Role[]) {
  if (roles.includes("course-coordinator")) return ["course-coordinator"] as Role[];
  return roles;
}
