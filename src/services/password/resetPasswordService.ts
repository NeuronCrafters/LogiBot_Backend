import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "../../config/resetPassword/findUserByEmail";

class ResetPasswordService {
  async resetPassword(token: string, newPassword: string) {
    const secret = process.env.JWT_SECRET || "default_secret";

    try {

      const decoded = jwt.verify(token, secret) as { id: string };


      const user = await findUserByEmail(decoded.id);

      if (!user || user.resetPasswordToken !== token || user.resetPasswordExpires <= new Date()) {
        throw new Error("Token inválido ou expirado.");
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
    } catch (error) {
      throw new Error("Falha ao redefinir senha. Verifique o token.");
    }
  }
}

export { ResetPasswordService };
