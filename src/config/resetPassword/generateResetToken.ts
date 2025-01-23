import jwt from "jsonwebtoken";
import { findUserByEmail } from "../../config/resetPassword/findUserByEmail";

class GenerateResetToken {
  async execute(email: string, model: "User" | "Professor") {
    const secret = process.env.JWT_SECRET || "default_secret";

    // Encontrar o usuário pelo e-mail
    const user = await findUserByEmail(email, model);

    if (!user) {
      throw new Error("Usuário não encontrado.");
    }

    // Verificar se já existe um token válido
    if (user.resetPasswordExpires && user.resetPasswordExpires > new Date()) {
      throw new Error("Aguarde 2 horas antes de solicitar outro e-mail de redefinição.");
    }

    // Gerar o token JWT
    const token = jwt.sign({ id: user._id }, secret, { expiresIn: "1h" });

    // Atualizar o banco com o token e a validade
    user.resetPasswordToken = token;
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hora
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
    return { token, resetLink };
  }
}

export { GenerateResetToken };
