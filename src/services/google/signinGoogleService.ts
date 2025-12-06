import { sign } from "jsonwebtoken";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

class SigninGoogleService {
  async login(profile: any) {
    const email = profile.emails?.[0]?.value;

    if (!email) {
      throw new Error("Email não encontrado no perfil do Google.");
    }

    let user: any = null;
    let userType: "professor" | "student" | "admin" | null = null;

    user = await Professor.findOne({ email }).select(
      "name email role school courses classes status"
    );

    if (user) {
      userType = "professor";
    }

    if (!user) {
      user = await User.findOne({ email }).select(
        "name email role school course class status"
      );

      if (user) {
        const roles = Array.isArray(user.role) ? user.role : [user.role];
        if (roles.includes("admin")) {
          userType = "admin";
        } else {
          userType = "student";
        }
      }
    }

    if (!user || !userType) {
      return {
        user: null,
        token: null,
        message: "Usuário não encontrado."
      };
    }

    if (user.status !== "active") {
      return {
        user: null,
        token: null,
        message: "Usuário inativo. Entre em contato com o administrador."
      };
    }

    const roles = Array.isArray(user.role) ? user.role : [user.role];

    const secret = process.env.JWT_SECRET || "defaultSecret";

    const tokenPayload: any = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: roles,
    };

    if (user.school) {
      tokenPayload.school = user.school;
    }

    const token = sign(tokenPayload, secret, {
      subject: user._id.toString(),
      expiresIn: "1d",
    });

    const userResponse: any = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: roles,
      userType,
    };

    if (userType === "professor") {
      userResponse.school = user.school ?? null;
      userResponse.courses = user.courses ?? [];
      userResponse.classes = user.classes ?? [];
    } else if (userType === "student") {
      userResponse.school = user.school ?? null;
      userResponse.course = user.course ?? null;
      userResponse.class = user.class ?? null;
    } else if (userType === "admin") {
      userResponse.school = null;
      userResponse.course = null;
      userResponse.class = null;
    }

    return {
      user: userResponse,
      token,
      message: null,
    };
  }
}

export { SigninGoogleService };
