import { Model } from "@/types/UuidCompat";
import { AppError } from "../../exceptions/AppError";
import { getUserModelByRole } from "../../utils/getUserModelByRole";
import { UserAnalysis } from "../../models/UserAnalysis";

interface UpdateEmailDTO {
  userId: string;
  role: string | string[];
  email: string;
}

class UpdateEmailService {
  async execute({ userId, role, email }: UpdateEmailDTO) {
    if (!email) {
      throw new AppError("O email é obrigatório.", 400);
    }

    const AccountModel = getUserModelByRole(role) as Model<any>;
    const user = await AccountModel.findById(userId);

    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    if (email !== user.email) {
      const emailExists = await AccountModel.findOne({ email });

      if (emailExists) {
        throw new AppError("Este e-mail já está em uso.", 409);
      }

      user.email = email;
      await user.save();

      await UserAnalysis.updateOne({ userId }, { email });
    }

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }
}

export { UpdateEmailService };