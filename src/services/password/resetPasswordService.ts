import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { findUserByEmail } from "../../config/resetPassword/findUserByEmail";

export const resetPasswordService = async (
  token: string,
  newPassword: string,
  model: "User" | "Professor"
) => {
  const secret = process.env.JWT_SECRET || "default_secret";

  const decoded: { id: string } = jwt.verify(token, secret) as { id: string };

  const user = await findUserByEmail(decoded.id, model);

  if (!user || user.resetPasswordToken !== token || user.resetPasswordExpires <= new Date()) {
    throw new Error("Token inválido ou expirado.");
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();
};
