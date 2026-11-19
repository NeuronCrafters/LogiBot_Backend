import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { isSandboxConfigured, runInEnvironment, type DatabaseEnvironment } from "../db/environment";
import { AppError } from "../exceptions/AppError";
import { isSandboxEmail } from "../services/sandbox/sandboxConfig";

/** Requests that identify the account by e-mail before there is a session. */
const SIGN_IN_PATHS = ["/auth/session", "/auth/password-reset-requests"];

/** Environment of the request: the e-mail domain when signing in, then the claim of the signed session. */
export function requestEnvironment(req: Request): DatabaseEnvironment {
  if (SIGN_IN_PATHS.indexOf(req.path) !== -1 && req.method === "POST") return isSandboxEmail(req.body?.email) ? "sandbox" : "production";
  const token = req.cookies?.token;
  if (!token || !process.env.JWT_SECRET) return "production";
  try {
    // Signature checked here so nobody can switch database with a forged claim; expiry is checked by requireAuth.
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { ignoreExpiration: true }) as jwt.JwtPayload;
    return decoded.env === "sandbox" ? "sandbox" : "production";
  } catch {
    return "production";
  }
}

/** Runs the whole request against the database of its environment (production or test). */
export function environmentMiddleware(req: Request, _res: Response, next: NextFunction) {
  // Test accounts exist only in the test environment: they cannot be created through sign-up.
  if (req.path === "/auth/register" && req.method === "POST" && isSandboxEmail(req.body?.email))
    return next(new AppError("sandbox.registerBlocked", 403));
  const environment = requestEnvironment(req);
  if (environment === "sandbox" && !isSandboxConfigured()) return next(new AppError("sandbox.notConfigured", 503));
  return runInEnvironment(environment, () => next());
}
