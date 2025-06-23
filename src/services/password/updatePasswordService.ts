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
      throw new Error("ID inválido.");
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
      throw new Error("Usuário não encontrado.");
    }

    const storedHash = userData.password;

    // Valida senha atual
    const isCurrentValid = await bcrypt.compare(currentPassword, storedHash);
    if (!isCurrentValid) {
      throw new Error("Senha atual incorreta.");
    }

    // Impede reutilização da senha atual
    const isSamePassword = await bcrypt.compare(newPassword, storedHash);
    if (isSamePassword) {
      throw new Error("A nova senha deve ser diferente da senha atual.");
    }

    // Impede senhas já usadas nos últimos 3 meses
    const history = userData.previousPasswords || [];
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    for (const entry of history) {
      const reused = await bcrypt.compare(newPassword, entry.hash);
      const recent = entry.changedAt > threeMonthsAgo;

      if (reused && recent) {
        throw new Error("A nova senha não pode ser igual a uma das últimas utilizadas nos últimos 3 meses.");
      }
    }

    // Gera novo hash
    const newHash = await bcrypt.hash(newPassword, 10);

    // Prepara histórico truncado (até 15 registros)
    const updatedHistory = [
      ...history,
      { hash: storedHash, changedAt: new Date() },
    ].slice(-15);

    // Atualiza no banco
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
