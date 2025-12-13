import { Model } from "mongoose";
import { AppError } from "../../exceptions/AppError";
import { getUserModelByRole } from "../../utils/getUserModelByRole";

interface UpdateNameDTO {
  userId: string;
  role: string | string[];
  name: string;
}

class UpdateNameService {
  async execute({ userId, role, name }: UpdateNameDTO) {
    if (!name || name.trim().length === 0) {
      throw new AppError("O nome é obrigatório.", 400);
    }

    const AccountModel = getUserModelByRole(role) as Model<any>;

    const user = await AccountModel.findById(userId);

    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    user.name = name;
    await user.save();

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }
}

export { UpdateNameService };