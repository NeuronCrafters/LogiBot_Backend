import { Request, Response, NextFunction } from "express";
import { sign } from "jsonwebtoken";
import { UserAnalysis, getEmptySubjectCounts } from "../../models/UserAnalysis";
import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";

function normalizeRoles(roleField: string | string[] | null | undefined): string[] {
  if (!roleField) return [];
  if (Array.isArray(roleField)) return roleField.filter(Boolean);
  return [roleField];
}

function prioritizeRole(roles: string[]): string[] {
  if (roles.includes("course-coordinator")) {
    return ["course-coordinator"];
  }
  return roles;
}

function isProductionRequest(req: Request): boolean {
  const referer = req.get("referer") || "";
  const host = req.get("host") || "";
  return referer.includes("saellogibot.com") || host.includes("saellogibot.com");
}

function getFrontendUrl(req: Request): string {
  if (isProductionRequest(req)) {
    return "https://saellogibot.com";
  }
  return "http://localhost:5173";
}

class GoogleAuthController {
  async callback(req: Request, res: Response, next: NextFunction) {
    try {
      const user: any = req.user;

      if (!user) {
        console.log("callback do google: usuário não encontrado");
        const redirectUrl = getFrontendUrl(req);
        return res.redirect(`${redirectUrl}?error=auth_failed`);
      }

      console.log("callback do google: usuário autenticado:", {
        id: user._id,
        email: user.email,
        type: user.type
      });

      const isProfessor = user.type === "professor";
      const roles = prioritizeRole(normalizeRoles(user.role));

      const isStudent = roles.includes("student");
      const isAdmin = roles.includes("admin");
      const hasAcademicData = user.course && user.class;

      if (!isProfessor && isStudent && !isAdmin && hasAcademicData) {
        let userAnalysis = await UserAnalysis.findOne({ userId: user._id.toString() });

        if (!userAnalysis) {
          const schoolDoc = await University.findById(user.school);
          const courseDoc = await Course.findById(user.course);
          const classDoc = await Class.findById(user.class);

          if (schoolDoc && courseDoc && classDoc) {
            userAnalysis = new UserAnalysis({
              userId: user._id.toString(),
              name: user.name,
              email: user.email,
              schoolId: user.school,
              schoolName: schoolDoc.name,
              courseId: user.course,
              courseName: courseDoc.name,
              classId: user.class,
              className: classDoc.name,
            });
          }
        }

        if (userAnalysis) {
          const lastSession = userAnalysis.sessions.at(-1);
          if (lastSession && !lastSession.sessionEnd) {
            lastSession.sessionEnd = new Date(lastSession.lastActivityAt || lastSession.sessionStart);
            lastSession.sessionDuration = (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;
          }

          const newSession = {
            sessionStart: new Date(),
            lastActivityAt: new Date(),
            totalCorrectAnswers: 0,
            totalWrongAnswers: 0,
            subjectCountsChat: getEmptySubjectCounts(),
            answerHistory: [],
          };

          userAnalysis.sessions.push(newSession);
          await userAnalysis.save();
          console.log("sessão de useranalysis criada para o estudante");
        }
      }

      const token = sign(
        {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: roles,
          school: user.school
        },
        process.env.JWT_SECRET!,
        { subject: user._id.toString(), expiresIn: "2h" }
      );

      const isProduction = isProductionRequest(req);

      res.cookie("token", token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 1000 * 60 * 60 * 2,
        domain: isProduction ? ".saellogibot.com" : undefined,
        path: "/"
      });

      console.log("cookie de autenticação definido:", {
        isProduction,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        domain: isProduction ? ".saellogibot.com" : "undefined"
      });

      const redirectUrl = getFrontendUrl(req);
      console.log("redirecionando para:", `${redirectUrl}chat?login=success`);
      return res.redirect(`${redirectUrl}/chat?login=success`);

    } catch (error: any) {
      console.error("erro no callback do google:", error);
      const redirectUrl = getFrontendUrl(req);
      return res.redirect(`${redirectUrl}?error=auth_error`);
    }
  }
}

export { GoogleAuthController };