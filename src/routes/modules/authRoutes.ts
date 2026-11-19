import { getEmailLanguage } from "../../i18n";
import { accountLanguage } from "../../i18n/middleware";
import { t } from "../../i18n";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { AppError } from "../../exceptions/AppError";
import { asyncHandler } from "../../http/asyncHandler";
import {
  requireAuth,
  requireEnv,
  prioritizeRoles,
  signSession,
} from "../../http/auth";
import { clearAuthCookie, clearOwnerReturnCookie, setAuthCookie } from "../../http/cookies";
import { getDb } from "../../db/client";
import { currentEnvironment } from "../../db/environment";
import { isOwner } from "../../services/sandbox/sandboxConfig";
import { accounts, passwordHistory } from "../../db/schema";
import {
  createStudentAccount,
  findEntitiesByClassCode,
  getAccountByEmail,
  getAccountById,
  getPublicMe,
  startStudentSession,
} from "../../db/repositories/authRepository";
import { sendPasswordResetEmail } from "../../services/email/mailService";
import { getFrontendOrigin } from "../../config/env";
import { createLoginSession, logoutSession, recordSessionActivity } from "../../services/auth/sessionLifecycleService";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    const confirmPassword = String(req.body.confirmPassword || "");
    const code = String(req.body.code || "").trim();

    if (!name || !email || !password || !code)
      throw new AppError("registration.fieldsRequired",
        400,
      );
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new AppError("registration.emailInvalid", 400);
    if (password.length < 12)
      throw new AppError("registration.passwordTooShort", 400);
    if (confirmPassword !== password)
      throw new AppError("registration.passwordMismatch", 400);

    const db = getDb();
    const existingUser = await getAccountByEmail(db, email);
    if (existingUser)
      throw new AppError("registration.emailExists", 409);

    const entities = await findEntitiesByClassCode(db, code);
    if (!entities) throw new AppError("registration.classCodeInvalid", 404);
    const {
      university,
      course,
      class: selectedClass,
      disciplines: linkedDisciplines,
    } = entities;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createStudentAccount(db, {
      name,
      email,
      passwordHash,
      schoolId: university.id,
      courseId: course.id,
      classId: selectedClass.id,
    });
    if (!user) throw new AppError("registration.creationFailed", 500);

    return res.status(201).json({
      message: t("registration.created"),
      user: {
        user: {
          _id: user.id,
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.roles,
          school: {
            _id: university.id,
            id: university.id,
            name: university.name,
          },
          course: { _id: course.id, id: course.id, name: course.name },
          class: {
            _id: selectedClass.id,
            id: selectedClass.id,
            name: selectedClass.name,
            registrationCode: selectedClass.registrationCode,
          },
          disciplines: linkedDisciplines.map((discipline) => ({
            _id: discipline.id,
            id: discipline.id,
            name: discipline.name,
          })),
        },
        assignedClass: { id: selectedClass.id, name: selectedClass.name },
        disciplines: linkedDisciplines.map((discipline) => ({
          id: discipline.id,
          name: discipline.name,
        })),
        course: { id: course.id, name: course.name },
        university: { id: university.id, name: university.name },
      },
    });
  }),
);

authRouter.post(
  "/session",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    const db = getDb();
    const user = await getAccountByEmail(db, email);
    if (!user || !password || !user.passwordHash)
      throw new AppError("auth.credentialsInvalid", 401);
    if (user.status !== "active")
      throw new AppError("auth.inactiveContactAdmin",
        403,
      );
    if (!(await bcrypt.compare(password, user.passwordHash)))
      throw new AppError("auth.credentialsInvalid", 401);

    accountLanguage(req, res, user.preferredLanguage);
    const roles = prioritizeRoles(user.roles || []);
    const session = await createLoginSession(db, { ...user, roles });
    const token = signSession({
      id: user.id,
      sid: session.id,
      name: user.name,
      email: user.email,
      role: roles,
      school: user.schoolId || null,
      env: currentEnvironment(),
    });
    setAuthCookie(req, res, token);

    return res.json({
      success: true,
      session,
      user: {
        id: user.id,
        _id: user.id,
        preferredLanguage: user.preferredLanguage,
        name: user.name,
        email: user.email,
        role: roles,
        school: user.schoolId,
        courses: roles.some((role) =>
          ["professor", "course-coordinator"].includes(role),
        )
          ? user.courses || []
          : user.courseId,
        classes: roles.some((role) =>
          ["professor", "course-coordinator"].includes(role),
        )
          ? user.classes || []
          : undefined,
        class: roles.includes("student") ? user.classId : undefined,
        disciplines: user.disciplines || [],
      },
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const account = await getAccountById(getDb(), req.user!.id);
    if (!account) throw new AppError("auth.userNotFound", 404);
    return res.json({
      ...await getPublicMe(getDb(), account),
      session: req.sessionStatus,
      environment: currentEnvironment(),
      // Owner who entered the test environment and can go back to their own account.
      canReturnToOwner: currentEnvironment() === "sandbox" && !!req.cookies?.owner_return,
      isOwner: currentEnvironment() === "production" && isOwner(req.user),
    });
  }),
);

authRouter.get("/session-status", requireAuth, (_req, res) => res.json(_req.sessionStatus));

authRouter.post("/activity", requireAuth, asyncHandler(async (req, res) => {
  const session = await recordSessionActivity(getDb(), req.authSessionId!, req.user!.id);
  return res.json(session);
}));

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await logoutSession(getDb(), req.authSessionId!, req.user!.id);
    clearAuthCookie(req, res);
    clearOwnerReturnCookie(req, res);
    return res.json({ message: t("auth.loggedOut") });
  }),
);

authRouter.post(
  "/password-reset-requests",
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const account = await getAccountByEmail(getDb(), email);
    if (!account)
      return res.json({
        message: t("auth.resetRequested"),
      });
    const token = jwt.sign({ email }, requireEnv("JWT_SECRET"), {
      expiresIn: "30m",
    });
    const frontendUrl = getFrontendOrigin(req.get("origin"));
    const resetLink = `${frontendUrl.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

    await getDb()
      .update(accounts)
      .set({
        resetPasswordToken: token,
        resetPasswordExpires: new Date(Date.now() + 30 * 60 * 1000),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));

    await sendPasswordResetEmail({
      to: account.email,
      name: account.name,
      resetLink,
      language: getEmailLanguage(account.preferredLanguage),
    });
    const includeDebugResetData =
      process.env.PASSWORD_RESET_DEBUG_RESPONSE === "true";

    return res.json({
      message: t("auth.resetRequested"),
      resetToken: includeDebugResetData ? token : undefined,
      resetLink: includeDebugResetData ? resetLink : undefined,
    });
  }),
);

authRouter.patch(
  "/password-reset",
  asyncHandler(async (req, res) => {
    const token = String(req.body.token || "");
    const newPassword = String(req.body.newPassword || "");
    if (!token || !newPassword)
      throw new AppError("auth.resetFieldsRequired", 400);
    const decoded = jwt.verify(token, requireEnv("JWT_SECRET")) as {
      email?: string;
    };
    const [account] = await getDb()
      .select()
      .from(accounts)
      .where(eq(accounts.email, String(decoded.email || "").toLowerCase()))
      .limit(1);
    if (
      !account ||
      account.resetPasswordToken !== token ||
      !account.resetPasswordExpires ||
      new Date() > account.resetPasswordExpires
    ) {
      throw new AppError("auth.resetTokenInvalid", 400);
    }
    const hash = await bcrypt.hash(newPassword, 10);
    await getDb()
      .insert(passwordHistory)
      .values({ accountId: account.id, hash: account.passwordHash || "" });
    await getDb()
      .update(accounts)
      .set({
        passwordHash: hash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, account.id));
    return res.json({ message: t("auth.passwordReset") });
  }),
);
