import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "../../config/resetPassword/findUserByEmail";

class ResetPasswordService {
  async resetPassword(token: string, newPassword: string) {
    const secret = process.env.JWT_SECRET || "default_secret";

    try {
      const decoded = jwt.verify(token, secret) as { email: string };
      const user = await findUserByEmail(decoded.email);

      if (
          !user ||
          user.resetPasswordToken !== token ||
          !user.resetPasswordExpires ||
          new Date() > user.resetPasswordExpires
      ) {
        throw new Error("Token inválido ou expirado.");
      }

      const isSamePassword = await bcrypt.compare(newPassword, user.password || "");
      if (isSamePassword) {
        throw new Error("A nova senha não pode ser igual à senha anterior.");
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;

      await user.save();
    } catch (error: any) {
      throw new Error(error?.message || "Falha ao redefinir senha.");
    }
  }
}

export { ResetPasswordService };
