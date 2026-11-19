import { Router } from "express";
import jwt from "jsonwebtoken";
import { getDb } from "../../db/client";
import { currentEnvironment, isSandboxConfigured, runInEnvironment } from "../../db/environment";
import { getAccountByEmail, getAccountById } from "../../db/repositories/authRepository";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import { prioritizeRoles, requireAuth, requireEnv, signSession } from "../../http/auth";
import { clearOwnerReturnCookie, OWNER_RETURN_COOKIE, setAuthCookie, setOwnerReturnCookie } from "../../http/cookies";
import { logger } from "../../logger";
import { createLoginSession, logoutSession, validateSession } from "../../services/auth/sessionLifecycleService";
import { suppressedMails } from "../../services/email/mailService";
import { isOwner, isSandboxEmail } from "../../services/sandbox/sandboxConfig";
import { resetSandbox, sandboxAccounts, SANDBOX_STRUCTURE } from "../../services/sandbox/sandboxSeed";
import { DEMO_PERIODS } from "../../services/sandbox/sandboxDemoData";

export const devRouter = Router();

/** Owner of the platform, signed in to their real (production) account. */
const requireOwner = [requireAuth, (req: import("express").Request, _res: import("express").Response, next: import("express").NextFunction) => {
  if (currentEnvironment() !== "production" || !isOwner(req.user)) return next(new AppError("auth.accessDeniedCapital", 403));
  return next();
}];

devRouter.get(
  "/status",
  ...requireOwner,
  asyncHandler(async (_req, res) => res.json({
    configured: isSandboxConfigured(),
    passwordConfigured: (process.env.SANDBOX_PASSWORD || "").length >= 12,
    structure: SANDBOX_STRUCTURE,
    accounts: sandboxAccounts(),
    periods: DEMO_PERIODS,
    suppressedMails,
  })),
);

devRouter.post(
  "/sandbox/reset",
  ...requireOwner,
  asyncHandler(async (req, res) => {
    const result = await resetSandbox(req.body?.days ?? 0);
    logger.info("Dev", "Test environment reset.", { by: req.user!.id });
    return res.json(result);
  }),
);

// Uses a test account without its password; the owner's own session is kept to come back.
devRouter.post(
  "/sandbox/enter",
  ...requireOwner,
  asyncHandler(async (req, res) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    if (!isSandboxEmail(email)) throw new AppError("sandbox.accountNotFound", 404);
    if (!isSandboxConfigured()) throw new AppError("sandbox.notConfigured", 503);
    const ownerToken = req.cookies?.token as string;
    const { token, account } = await runInEnvironment("sandbox", async () => {
      const found = await getAccountByEmail(getDb(), email);
      if (!found || found.status !== "active") throw new AppError("sandbox.accountNotFound", 404);
      const roles = prioritizeRoles(found.roles || []);
      const session = await createLoginSession(getDb(), { ...found, roles });
      return {
        account: found,
        token: signSession({ id: found.id, sid: session.id, name: found.name, email: found.email, role: roles, school: found.schoolId || null, env: "sandbox" }),
      };
    });
    logger.info("Dev", "Owner entered the test environment.", { owner: req.user!.id, account: account.id });
    setOwnerReturnCookie(req, res, ownerToken);
    setAuthCookie(req, res, token);
    return res.json({ environment: "sandbox", email: account.email });
  }),
);

// Ends the test session and restores the owner's own session.
devRouter.post(
  "/sandbox/leave",
  asyncHandler(async (req, res) => {
    const ownerToken = req.cookies?.[OWNER_RETURN_COOKIE];
    if (!ownerToken) throw new AppError("auth.tokenMissing", 401);
    let owner: jwt.JwtPayload;
    try {
      owner = jwt.verify(ownerToken, requireEnv("JWT_SECRET")) as jwt.JwtPayload;
    } catch {
      clearOwnerReturnCookie(req, res);
      throw new AppError("auth.sessionExpired", 401);
    }
    if (owner.env === "sandbox") throw new AppError("auth.tokenInvalid", 401);
    await runInEnvironment("production", async () => {
      await validateSession(getDb(), String(owner.sid), String(owner.sub || owner.id));
      const account = await getAccountById(getDb(), String(owner.sub || owner.id));
      if (!account || !isOwner({ email: account.email, role: account.roles })) throw new AppError("auth.accessDeniedCapital", 403);
    });
    const testToken = req.cookies?.token;
    if (testToken) {
      try {
        const test = jwt.verify(testToken, requireEnv("JWT_SECRET"), { ignoreExpiration: true }) as jwt.JwtPayload;
        if (test.env === "sandbox") await runInEnvironment("sandbox", () => logoutSession(getDb(), String(test.sid), String(test.sub || test.id)));
      } catch { /* the test session simply expires */ }
    }
    setAuthCookie(req, res, ownerToken);
    clearOwnerReturnCookie(req, res);
    return res.json({ environment: "production" });
  }),
);
