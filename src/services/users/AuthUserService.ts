import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import { UserAnalysis } from "../../models/UserAnalysis";
import { compare } from "bcryptjs";
import { sign } from "jsonwebtoken";
import { AppError } from "../../exceptions/AppError";

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

    // Cria o token JWT com os dados do usuário
    const token = sign(
      {
        name: user.name,
        email: user.email,
        role: roles,
        school: user.school || "desconhecido",
        courses: user.course || "desconhecido",
        classes: user.class || "desconhecido",
      },
      process.env.JWT_SECRET!,
      {
        subject: user._id.toString(),
        expiresIn: "1d",
      }
    );

    // Retorna os dados do usuário
    const responseData = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: roles,
      school: user.school || "desconhecido",
      courses: user.course || "desconhecido",
      classes: user.class || "desconhecido",
      sessionStart,
      token,
    };

    console.log(`[LOGIN] Usuário autenticado: ${responseData.email}`);

    // Envia os dados para o UserAnalysis 
    setImmediate(async () => {
      try {
        const result = await UserAnalysis.findOneAndUpdate(
          { userId: responseData.id },
          {
            $setOnInsert: {
              userId: responseData.id,
              name: responseData.name,
              email: responseData.email,
              school: responseData.school,
              courses: responseData.courses,
              classes: responseData.classes
            },
            $push: {
              sessions: { sessionStart: responseData.sessionStart },
            },
          },
          { upsert: true, new: true }
        );

        if (result) {
          console.log(`[UserAnalysis] Dados atualizados para usuário: ${responseData.email}`);
        } else {
          console.log(`[UserAnalysis] Novo usuário registrado: ${responseData.email}`);
        }
      } catch (error) {
        console.error("[UserAnalysis] Erro ao registrar usuário:", error);
      }
    });

    return responseData;
  }
}

export { AuthUserService };
