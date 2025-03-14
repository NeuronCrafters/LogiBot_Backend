import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import { UserAnalysis } from "../../models/UserAnalysis";
import { compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { AppError } from "../../exceptions/AppError";
import useragent from "express-useragent";

interface AuthRequest {
  email: string;
  password?: string;
  googleId?: string;
}

function normalizeRoles(roleField: string | string[] | null | undefined): string[] {
  if (!roleField) return [];
  if (Array.isArray(roleField)) return roleField.filter(Boolean);
  return [roleField];
}

class AuthUserService {
  async signin({ email, password, googleId }: AuthRequest) {
    const isSocialLogin = googleId != null;

    let user = isSocialLogin
      ? await User.findOne({ googleId })
      : await User.findOne({ email });

    if (!user) {
      user = isSocialLogin
        ? await Professor.findOne({ googleId })
        : await Professor.findOne({ email });
    }

    if (!user) {
      throw new AppError("Credenciais inválidas.", 401);
    }

    const roles = normalizeRoles(user.role);

    // Login via Google
    if (isSocialLogin) {
      if (!user.googleId) {
        throw new AppError("Credenciais sociais inválidas.", 401);
      }
    } else {
      if (!user.password) {
        throw new AppError("Usuário com erros nas credenciais!", 401);
      }

      const passwordMatch = await compare(password!, user.password);
      if (!passwordMatch) {
        throw new AppError("Credenciais inválidas.", 401);
      }
    }

    // Captura a hora atual da sessão do usuário
    const sessionStart = new Date();

    // Simulação de captura de dispositivo do usuário
    const deviceInfo = {
      deviceType: "desktop",
      os: "Windows",
      browser: "Chrome",
      timestamp: sessionStart,
    };

    // Define valores padrão para evitar erro de validação
    const school = user.school ? user.school.toString() : "Desconhecido";
    const courses = user.course ? user.course.toString() : "Desconhecido";
    const classes = user.class ? user.class.toString() : "Desconhecido";

    // Cria o token JWT
    const token = sign(
      {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: roles,
        school,
        courses,
        classes,
      },
      process.env.JWT_SECRET!,
      {
        subject: user._id.toString(),
        expiresIn: "1d",
      }
    );

    // Atualiza ou cria o UserAnalysis com a nova sessão
    setImmediate(async () => {
      try {
        const existingUserAnalysis = await UserAnalysis.findOne({ userId: user._id.toString() });

        if (existingUserAnalysis && existingUserAnalysis.sessions.length > 0) {
          const lastSession = existingUserAnalysis.sessions[existingUserAnalysis.sessions.length - 1];

          if (!lastSession.sessionEnd) {
            // Sessão já existente ativa, não criar uma nova
            console.log(`[UserAnalysis] Sessão já aberta para: ${user.email}`);
          } else {
            // Criar nova sessão
            existingUserAnalysis.sessions.push({
              sessionStart,
              devices: [deviceInfo],
              levels: [],
              interactions: [],
              answerHistory: [],
              interactionsOutsideTheClassroom: [],
            });

            await existingUserAnalysis.save();
            console.log(`[UserAnalysis] Nova sessão iniciada para: ${user.email}`);
          }
        } else {
          // Criar novo UserAnalysis
          await UserAnalysis.create({
            userId: user._id.toString(),
            name: user.name,
            email: user.email,
            school,
            courses,
            classes,
            sessions: [
              {
                sessionStart,
                devices: [deviceInfo],
                levels: [],
                interactions: [],
                answerHistory: [],
                interactionsOutsideTheClassroom: [],
              },
            ],
          });

          console.log(`[UserAnalysis] Novo usuário registrado e sessão iniciada: ${user.email}`);
        }
      } catch (error) {
        console.error("[UserAnalysis] Erro ao registrar usuário:", error);
      }
    });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: roles,
      school,
      courses,
      classes,
      sessionStart,
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
