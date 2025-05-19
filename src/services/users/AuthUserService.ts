import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { UserAnalysis } from "../../models/UserAnalysis";
import { compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { AppError } from "../../exceptions/AppError";

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

interface AuthRequest {
  email: string;
  password?: string;
  googleId?: string;
}

class AuthUserService {
  async signin({ email, password, googleId }: AuthRequest) {
    const isSocial = !!googleId;
    let user = isSocial
        ? await User.findOne({ googleId })
        : await User.findOne({ email });

    if (!user) {
      user = isSocial
          ? await Professor.findOne({ googleId })
          : await Professor.findOne({ email });
    }
    if (!user) throw new AppError("Credenciais inválidas.", 401);

    // verifica senha se for login normal
    if (!isSocial) {
      if (!password) throw new AppError("Senha não fornecida.", 400);
      if (!user.password) throw new AppError("Usuário sem senha cadastrada.", 401);
      const match = await compare(password, user.password);
      if (!match) throw new AppError("Credenciais inválidas.", 401);
    }

    if (normalizeRoles(user.role).includes("student")) {
      let ua = await UserAnalysis.findOne({ userId: user._id.toString() });
      if (!ua) {
        // busca nomes das entidades referenciadas
        const schoolDoc = await University.findById(user.school);
        const courseDoc = await Course.findById(user.course);
        const classDoc  = await Class.findById(user.class);

        ua = new UserAnalysis({
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          schoolId: user.school,
          schoolName: schoolDoc?.name  || "",
          courseId: user.course,
          courseName: courseDoc?.name  || "",
          classId: user.class,
          className: classDoc?.name   || "",
          totalUsageTime: 0,
          totalCorrectWrongAnswers: {
            totalCorrectAnswers: 0,
            totalWrongAnswers:   0,
          },
          subjectCounts: {
            variaveis: 0,
            tipos: 0,
            funcoes: 0,
            loops: 0,
            verificacoes: 0,
          },
          sessions: [
            {
              sessionStart: new Date(),
              totalCorrectAnswers: 0,
              totalWrongAnswers: 0,
              subjectFrequency: new Map(),
              answerHistory: [],
            },
          ],
        });
        await ua.save();
      } else {
        // se já existe, abre nova sessão se a última já tiver sido encerrada
        const last = ua.sessions.at(-1)!;
        if (last.sessionEnd) {
          ua.sessions.push({
            sessionStart: new Date(),
            totalCorrectAnswers: 0,
            totalWrongAnswers: 0,
            frequency: new Map(),
            quizHistory: [],
          });
          await ua.save();
        }
      }
    }

    const roles = prioritizeRole(normalizeRoles(user.role));
    const token = sign(
        {
          id:      user._id.toString(),
          name:    user.name,
          email:   user.email,
          role:    roles,
          school:  user.school,
          course:  user.course,
          class:   user.class,
        },
        process.env.JWT_SECRET!,
        {
          subject:   user._id.toString(),
          expiresIn: "1d",
        }
    );

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: roles,
      school: user.school,
      courses: user.course,
      classes: user.class,
      sessionStart: new Date(),
      token,
    };
  }

  async logout(userId: string) {
    try {
      const userAnalysis = await UserAnalysis.findOne({ userId });

      if (userAnalysis && userAnalysis.sessions.length > 0) {
        const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];

        if (!lastSession.sessionEnd) {
          lastSession.sessionEnd = new Date();
          lastSession.sessionDuration =
            (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;

          await userAnalysis.save();
          console.log(`[UserAnalysis] Sessão encerrada para usuário: ${userId}`);
        } else {
          console.log(`[UserAnalysis] Nenhuma sessão ativa encontrada para ${userId}`);
        }
      }
    } catch (error) {
      console.error("[UserAnalysis] Erro ao encerrar sessão:", error);
    }
  }
}

export { AuthUserService };
