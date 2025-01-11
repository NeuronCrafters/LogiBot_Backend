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

class AuthUserService {
  async signin({ email, password, googleId }: AuthRequest) {
    const isSocialLogin = googleId != null;

    let user = isSocialLogin ? await User.findOne({ googleId }) : await User.findOne({ email });
    if (!user) {
      user = isSocialLogin ? await Professor.findOne({ googleId }) : await Professor.findOne({ email });
    }

    if (!user) {
      throw new AppError("Credenciais inválidas.", 401);
    }

    if (isSocialLogin) {
      if (user.password) {
        const token = sign(
          {
            name: user.name,
            email: user.email,
            role: user.role,
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
          role: user.role,
          school: user.school,
          token,
          redirectTo: "/sael/talk",
        };
      } else {

        const token = sign(
          {
            name: user.name,
            email: user.email,
            role: user.role,
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
          role: user.role,
          school: user.school,
          token,
          message: "Por favor, confirme seus dados via email para completar seu registro.",
        };
      }
    }

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
        role: user.role,
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
      role: user.role,
      school: user.school,
      token,
    };
  }
}

export { AuthUserService };
