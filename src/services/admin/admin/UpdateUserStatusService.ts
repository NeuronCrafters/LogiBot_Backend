import { User } from "../../../models/User";
import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError";

type UserStatus = "active" | "inactive" | "graduated" | "dropped";

export class UpdateUserStatusService {
  public async execute(userId: string, status: UserStatus): Promise<any> {
    if (!status) {
      throw new AppError("o novo status é obrigatório.", 400);
    }
    if (!["active", "inactive", "graduated", "dropped"].includes(status)) {
      throw new AppError("status fornecido é inválido.", 400);
    }

    let user: any = await User.findById(userId);

    if (!user) {
      user = await Professor.findById(userId);
    }

    if (!user) {
      throw new AppError("usuário não encontrado.", 404);
    }

    user.status = status;
    await user.save();

    user.password = undefined;
    return user;
  }
}