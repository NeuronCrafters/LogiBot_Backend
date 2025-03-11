import { AppError } from "../../exceptions/AppError";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

class DetailsUserService {
  async detailsUser(user_id: string, role: string) {
    try {
      let userDetails;

      if (role === "professor") {
        userDetails = await Professor.findById(user_id)
          .select("name email role school course class department")
          .lean();
      } else if (role === "student" || role === "admin") {
        userDetails = await User.findById(user_id)
          .select("name email role school course class")
          .lean();
      } else {
        throw new AppError("Papel inválido!", 400);
      }

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