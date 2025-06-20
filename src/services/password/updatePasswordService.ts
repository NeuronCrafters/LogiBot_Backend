import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

interface IUserAuth {
  password: string;
}

type AllowedRoles = "professor" | "student" | "admin";

class UpdatePasswordService {
  async updatePassword(
      userId: string,
      currentPassword: string,
      newPassword: string,
      role: AllowedRoles
  ): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("ID inválido.");
    }

    /* Carrega o hash da senha atual, SEM criar interseções de Modelos */
    let userData: IUserAuth | null = null;

    if (role === "professor") {
      userData = await Professor
          .findById(userId)
          .select("password")
          .lean<IUserAuth>();
    } else {
      userData = await User
          .findById(userId)
          .select("password")
          .lean<IUserAuth>();
    }

    if (!userData?.password) {
      throw new Error("Usuário não encontrado.");
    }

    /* Valida senha atual e garante que a nova é diferente             */
    const { password: storedHash } = userData;

    const isCurrentValid = await bcrypt.compare(currentPassword, storedHash);
    if (!isCurrentValid) {
      throw new Error("Senha atual incorreta.");
    }

    const isSamePassword = await bcrypt.compare(newPassword, storedHash);
    if (isSamePassword) {
      throw new Error("A nova senha deve ser diferente da senha atual.");
    }

    /* Salva a nova senha (hash)                                       */
    const newHash = await bcrypt.hash(newPassword, 10);

    if (role === "professor") {
      await Professor.findByIdAndUpdate(userId, { password: newHash });
    } else {
      await User.findByIdAndUpdate(userId, { password: newHash });
    }
  }
}

export { UpdatePasswordService };
