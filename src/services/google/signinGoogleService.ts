import { sign } from "jsonwebtoken";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

class SigninGoogleService {
  async login(profile: any) {
    const email = profile.emails?.[0]?.value;
    if (!email) throw new Error("Email não encontrado no perfil do Google.");

    let user: any = await Professor.findOne({ email });
    let userType: "professor" | "student" | "admin" | null = null;

    if (user) userType = "professor";
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        userType = Array.isArray(user.role) && user.role.includes("admin") ? "admin" : "student";
      }
    }

    if (!user || !userType) return { user: null, token: null, message: "Usuário não encontrado." };
    if (user.status !== "active") return { user: null, token: null, message: "Usuário inativo." };

    const roles = Array.isArray(user.role) ? user.role : [user.role];

    const tokenPayload: any = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: roles,
      school: user.school ?? null,
      course: user.course ?? null,
      class: user.class ?? null,
      courses: user.courses ?? [],
      classes: user.classes ?? [],
    };

    const token = sign(tokenPayload, process.env.JWT_SECRET!, {
      subject: user._id.toString(),
      expiresIn: "2h",
    });

    return { user: tokenPayload, token, message: null };
  }
}

export { SigninGoogleService };
