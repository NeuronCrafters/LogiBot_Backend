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
      if (!user) user = await User.findOne({ googleId });
    } else {
      user = await Professor.findOne({ email }).select("name email role school courses classes password previousPasswords status");
      isProfessor = !!user;
      if (!user) user = await User.findOne({ email }).select("name email role school course class password status");
    }

    if (!user) throw new AppError("Credenciais inválidas.", 401);
    if (user.status !== 'active') {
      throw new AppError("Sua conta está inativa. Entre em contato com o administrador.", 403);
    }
    if (!isSocial) {
      if (!password) throw new AppError("Senha não fornecida.", 400);
      if (!user.password) throw new AppError("Este usuário precisa redefinir sua senha. Entre em contato com o administrador.", 401);
      const match = await compare(password, user.password);
      if (!match) throw new AppError("Credenciais inválidas.", 401);
    }

    if (!isProfessor && normalizeRoles(user.role).includes("student")) {
      try {
        let userAnalysis = await UserAnalysis.findOne({ userId: user._id.toString() });

        if (!userAnalysis) {
          const schoolDoc = await University.findById(user.school);
          const courseDoc = await Course.findById(user.course);
          const classDoc = await Class.findById(user.class);

          userAnalysis = new UserAnalysis({
            userId: user._id.toString(),
            name: user.name,
            email: user.email,
            schoolId: user.school,
            schoolName: schoolDoc?.name || "",
            courseId: user.course,
            courseName: courseDoc?.name || "",
            classId: user.class,
            className: classDoc?.name || "",
          });
        }

        const lastSession = userAnalysis.sessions.at(-1);
        if (lastSession && !lastSession.sessionEnd) {
          console.log(`[LOGIN] Fechando sessão zumbi anterior para ${user.email}`);
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
        console.log(`[LOGIN] Nova sessão de análise iniciada para ${user.email}`);

      } catch (error) {
        console.error(`[LOGIN] Falha ao processar sessão de análise para ${user.email}:`, error);
      }
    }

    const roles = prioritizeRole(normalizeRoles(user.role));
    const token = sign(
      { id: user._id.toString(), name: user.name, email: user.email, role: roles, school: user.school },
      process.env.JWT_SECRET!,
      { subject: user._id.toString(), expiresIn: "2h" }
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
      token,
    };
  }
}

export { AuthUserService };