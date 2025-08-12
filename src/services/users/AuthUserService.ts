import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import { University } from "../../models/University";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { UserAnalysis, getEmptySubjectCounts } from "../../models/UserAnalysis";
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

    let user: any;
    let isProfessor = false;

    if (isSocial) {
      user = await Professor.findOne({ googleId });
      isProfessor = !!user;
      console.log(`[DEBUG] Login social - Professor encontrado: ${!!user}`);

      if (!user) {
        user = await User.findOne({ googleId });
        console.log(`[DEBUG] Login social - User encontrado: ${!!user}`);
      }
    } else {
      user = await Professor
        .findOne({ email })
        // adicionar 'status' ao select de Professor
        .select("name email role school courses classes password previousPasswords status");
      isProfessor = !!user;
      console.log(`[DEBUG] Login tradicional - Professor encontrado: ${!!user}`);

      if (!user) {
        user = await User
          .findOne({ email })
          // adicionar 'status' ao select de User
          .select("name email role school course class password status");
        console.log(`[DEBUG] Login tradicional - User encontrado: ${!!user}`);
      }
    }

    if (!user) throw new AppError("Credenciais inválidas.", 401);

    // Verifica o status do usuário antes de qualquer outra coisa.
    if (user.status !== 'active') {
      throw new AppError("Sua conta está inativa. Entre em contato com o administrador.", 403);
    }

    // Verificação de senha (apenas se não for login social)
    if (!isSocial) {
      if (!password) throw new AppError("Senha não fornecida.", 400);
      if (!user.password) {
        console.error(`Usuário ${email} existe mas não possui senha cadastrada`);
        throw new AppError("Este usuário precisa redefinir sua senha. Entre em contato com o administrador.", 401);
      }

      const match = await compare(password, user.password);
      if (!match) throw new AppError("Credenciais inválidas.", 401);
    }

    // Inicialização de análise para alunos (estudantes)
    if (!isProfessor && normalizeRoles(user.role).includes("student")) {
      let ua = await UserAnalysis.findOne({ userId: user._id.toString() });
      if (!ua) {
        const schoolDoc = await University.findById(user.school);
        const courseDoc = await Course.findById(user.course);
        const classDoc = await Class.findById(user.class);

        ua = new UserAnalysis({
          userId: user._id.toString(),
          name: user.name,
          email: user.email,
          schoolId: user.school,
          schoolName: schoolDoc?.name || "",
          courseId: user.course,
          courseName: courseDoc?.name || "",
          classId: user.class,
          className: classDoc?.name || "",
          totalUsageTime: 0,
          totalCorrectWrongAnswers: { totalCorrectAnswers: 0, totalWrongAnswers: 0 },
          subjectCountsQuiz: {
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
              subjectCountsChat: getEmptySubjectCounts(),
              answerHistory: [],
            },
          ],
        });
        await ua.save();
      } else {
        const last = ua.sessions.at(-1);
        if (last && last.sessionEnd) {
          ua.sessions.push({
            sessionStart: new Date(),
            totalCorrectAnswers: 0,
            totalWrongAnswers: 0,
            subjectCountsChat: getEmptySubjectCounts(),
            answerHistory: [],
          });
          await ua.save();
        }
      }
    }

    const roles = prioritizeRole(normalizeRoles(user.role));
    const token = sign(
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: roles,
        school: user.school,
      },
      process.env.JWT_SECRET!,
      {
        subject: user._id.toString(),
        expiresIn: "1d",
      }
    );

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: roles,
      school: user.school,
      courses: isProfessor ? user.courses : user.course,
      classes: isProfessor ? (Array.isArray(user.classes) ? user.classes : []) : undefined,
      class: isProfessor ? undefined : user.class,
      sessionStart: new Date(),
      token,
    };
  }

  async logout(userId: string) {
    try {
      const userAnalysis = await UserAnalysis.findOne({ userId });

      if (userAnalysis && userAnalysis.sessions.length > 0) {
        const lastSession = userAnalysis.sessions.at(-1);
        if (lastSession && !lastSession.sessionEnd) {
          lastSession.sessionEnd = new Date();
          lastSession.sessionDuration =
            (lastSession.sessionEnd.getTime() - lastSession.sessionStart.getTime()) / 1000;

          await userAnalysis.save();
          console.log(`[UserAnalysis] Sessão encerrada para usuário: ${userId}`);
        }
      }
    } catch (error) {
      console.error("[UserAnalysis] Erro ao encerrar sessão:", error);
    }
  }
}

export { AuthUserService };