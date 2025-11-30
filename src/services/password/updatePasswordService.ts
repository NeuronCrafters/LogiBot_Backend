import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, IUser } from "../../models/User";
import { Professor, IProfessor } from "../../models/Professor";

type AllowedRoles = "professor" | "student" | "admin";

interface IUserAuth {
  password: string;
  previousPasswords?: { hash: string; changedAt: Date }[];
}

class UpdatePasswordService {
  async updatePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    role: AllowedRoles
  ): Promise<void> {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      throw new Error("id inválido.");
    }

    let userData: IUserAuth | null = null;

    if (role === "professor") {
      userData = await Professor
        .findById(userId)
        .select("password previousPasswords")
        .lean<IUserAuth>();
    } else {
      userData = await User
        .findById(userId)
        .select("password previousPasswords")
        .lean<IUserAuth>();
    }

    if (!userData?.password) {
      throw new Error("usuário não encontrado.");
    }

    const storedHash = userData.password;
    const isCurrentValid = await bcrypt.compare(currentPassword, storedHash);
    if (!isCurrentValid) {
      throw new Error("senha atual incorreta.");
    }

    const isSamePassword = await bcrypt.compare(newPassword, storedHash);
    if (isSamePassword) {
      throw new Error("a nova senha deve ser diferente da senha atual.");
    }

    const history = userData.previousPasswords || [];
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    for (const entry of history) {
      const reused = await bcrypt.compare(newPassword, entry.hash);
      const recent = entry.changedAt > threeMonthsAgo;

      if (reused && recent) {
        throw new Error("a nova senha não pode ser igual a uma das últimas utilizadas nos últimos 3 meses.");
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    const updatedHistory = [
      ...history,
      { hash: storedHash, changedAt: new Date() },
    ].slice(-15);

    if (role === "professor") {
      await Professor.findByIdAndUpdate(userId, {
        password: newHash,
        previousPasswords: updatedHistory,
      });
    } else {
      await User.findByIdAndUpdate(userId, {
        password: newHash,
        previousPasswords: updatedHistory,
      });
    }
  }
}

export { UpdatePasswordService };
