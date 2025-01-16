import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
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

      const token = sign(
        {
          name: user.name,
          email: user.email,
          role: roles,
          school: user.school || "",
        },
        process.env.JWT_SECRET!,
        {
          subject: user._id.toString(),
          expiresIn: "1d",
        }
      );

      return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: roles,
        school: user.school,
        token,
        redirectTo: "/sael/talk",
      };
    }

    // Login via senha
    if (!user.password) {
      throw new AppError("Usuário com erros nas credenciais!", 401);
    }

    const passwordMatch = await compare(password!, user.password);

    if (!passwordMatch) {
      throw new AppError("Credenciais inválidas.", 401);
    }

    const token = sign(
      {
        name: user.name,
        email: user.email,
        role: roles,
        school: user.school || "",
      },
      process.env.JWT_SECRET!,
      {
        subject: user._id.toString(),
        expiresIn: "1d",
      }
    );

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: roles,
      school: user.school,
      token,
    };
  }
}

export { AuthUserService };
