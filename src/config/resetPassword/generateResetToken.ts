import jwt from "jsonwebtoken";
import { findUserByEmail } from "../../config/resetPassword/findUserByEmail";

class GenerateResetToken {
  async execute(email: string) {
    const secret = process.env.JWT_SECRET || "default_secret";

    const user = await findUserByEmail(email);

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    const token = jwt.sign({ email: user.email }, secret, { expiresIn: "1h" });

    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000);
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    return { token, resetLink };
  }
}

export { GenerateResetToken };
