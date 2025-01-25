import jwt from "jsonwebtoken";
import { findUserByEmail } from "../../config/resetPassword/findUserByEmail";

class GenerateResetToken {
  async execute(email: string) {
    const secret = process.env.JWT_SECRET || "default_secret";

    const user = await findUserByEmail(email);

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    // if (user.resetPasswordExpires && user.resetPasswordExpires > new Date()) {
    //   throw new Error("Aguarde 2 horas antes de solicitar outro e-mail de redefinição.");
    // }

    const token = jwt.sign({ id: user._id }, secret, { expiresIn: "1h" });

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hora
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}?token=${token}`;
    return { token, resetLink };
  }
}

export { GenerateResetToken };
