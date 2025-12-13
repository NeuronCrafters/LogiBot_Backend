import { Model } from "mongoose";
import { hash, compare } from "bcryptjs";
import { AppError } from "../../exceptions/AppError";
import { getUserModelByRole } from "../../utils/getUserModelByRole";
import { IUser } from "../../models/User";
import { IProfessor } from "../../models/Professor";

interface UpdatePasswordDTO {
  userId: string;
  role: string | string[];
  currentPassword: string;
  newPassword: string;
}

class UpdatePasswordService {
  async execute({ userId, role, currentPassword, newPassword }: UpdatePasswordDTO) {
    const AccountModel = getUserModelByRole(role) as Model<IUser | IProfessor>;

    const user = await AccountModel.findById(userId).select("+password +previousPasswords");

    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    if (!user.password) {
      throw new AppError("Usuário não possui senha definida.", 400);
    }

    const isCurrentValid = await compare(currentPassword, user.password);
    if (!isCurrentValid) {
      throw new AppError("Senha atual incorreta.", 401);
    }

    const isSameAsCurrent = await compare(newPassword, user.password);
    if (isSameAsCurrent) {
      throw new AppError("A nova senha deve ser diferente da senha atual.", 400);
    }

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    if (user.previousPasswords && user.previousPasswords.length > 0) {
      for (const entry of user.previousPasswords) {
        const isRepeated = await compare(newPassword, entry.hash);
        const changedAt = new Date(entry.changedAt);
        const isRecent = changedAt > threeMonthsAgo;

        if (isRepeated && isRecent) {
          throw new AppError("A nova senha não pode ser igual a uma utilizada nos últimos 3 meses.", 400);
        }
      }
    }

    const newHistoryEntry = {
      hash: user.password,
      changedAt: new Date()
    };

    user.previousPasswords.push(newHistoryEntry);

    if (user.previousPasswords.length > 15) {
      user.previousPasswords = user.previousPasswords.slice(-15);
    }

    user.password = await hash(newPassword, 10);

    await user.save();
  }
}

export { UpdatePasswordService };