import { AppError } from "../../exceptions/AppError";
import { User } from "../../models/User";

class DetailsUserService {
  async detailsUser(user_id: string) {
    try {
      const userDetails = await User.findById(user_id)
        .select("name email role")
        .lean();

      if (!userDetails) {
        throw new AppError("Usuário não encontrado!", 404);
      }

      return userDetails;
    } catch (error) {
      console.error("Erro ao buscar detalhes do usuário:", error);

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError("Erro interno ao buscar usuário.", 500);
    }
  }
}

export { DetailsUserService };
