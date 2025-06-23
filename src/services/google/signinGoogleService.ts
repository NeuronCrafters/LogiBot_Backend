import { sign } from "jsonwebtoken";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

class SigninGoogleService {
  async login(profile: any) {
    const email = profile.emails?.[0]?.value;
    const photo = profile.photos?.[0]?.value;
    const googleId = profile.id;

    if (!email) throw new Error("Email não encontrado no perfil do Google.");

    let user: any = await Professor
        .findOne({ email })
        .select("name email role school googleId photo courses classes");
    let isProfessor = !!user;

    if (!user) {
      user = await User
          .findOne({ email })
          .select("name email role school googleId photo course class");
      isProfessor = false;
    }

    if (!user) {
      return { user: null, token: null, message: "Usuário não encontrado." };
    }

    let updated = false;
    if (!user.googleId) {
      user.googleId = googleId;
      updated = true;
    }
    if (photo && !user.photo) {
      user.photo = photo;
      updated = true;
    }
    if (updated) await user.save();

    const roles = user.role;
    const secret = process.env.JWT_SECRET || "defaultSecret";

    const token = sign(
        {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: roles,
          school: user.school,
        },
        secret,
        {
          subject: user._id.toString(),
          expiresIn: "1d",
        }
    );

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: roles,
        school: user.school,
        photo: user.photo,
        courses: isProfessor ? user.courses ?? [] : user.course ?? null,
        classes: isProfessor ? user.classes ?? [] : undefined,
        class: isProfessor ? undefined : user.class ?? null,
      },
      token,
      message: null,
    };
  }
}

export { SigninGoogleService };
