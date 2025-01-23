import jwt from "jsonwebtoken";
import { findUserByEmail } from "../../config/resetPassword/findUserByEmail";

const generateResetToken = async (email: string, model: "User" | "Professor") => {
  const user = await findUserByEmail(email, model);

  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  if (user.resetPasswordExpires && user.resetPasswordExpires > new Date()) {
    throw new Error("Aguarde 2 horas antes de solicitar outro e-mail de redefinição.");
  }

  const secret = process.env.JWT_SECRET || "default_secret";
  const token = jwt.sign({ id: user._id }, secret, { expiresIn: "1h" });

  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(Date.now() + 3600000);
  await user.save();

  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  return { token, resetLink };
};

export { generateResetToken }