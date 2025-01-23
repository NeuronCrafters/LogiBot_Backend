import bcrypt from "bcryptjs";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import mongoose from "mongoose";

class UpdatePasswordService {
  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    role: "professor" | "student" | "admin"
  ) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("ID inválido.");
    }

    let userDetails;

    if (role === "professor") {
      userDetails = await Professor.findById(userId).select("password").lean();
    } else if (role === "student" || role === "admin") {
      userDetails = await User.findById(userId).select("password").lean();
    } else {
      throw new Error("Papel inválido!");
    }

    if (!userDetails) {
      throw new Error("Usuário não encontrado.");
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, userDetails.password || "");
    if (!isPasswordValid) {
      throw new Error("Senha atual incorreta.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    if (role === "professor") {
      await Professor.findByIdAndUpdate(userId, { password: hashedPassword });
    } else {
      await User.findByIdAndUpdate(userId, { password: hashedPassword });
    }
  }
}

export { UpdatePasswordService };
