import { AppError } from "../../exceptions/AppError";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

class DetailsUserService {
  async detailsUser(user_id: string, role: string | string[]) {
    try {
      let userDetails;
      const roles = Array.isArray(role) ? role : [role];

      const isCoordinator = roles.includes("course-coordinator");
      const isProfessor = roles.includes("professor");
      const isStudent = roles.includes("student");
      const isAdmin = roles.includes("admin");

      if (isCoordinator || isProfessor) {
        userDetails = await Professor.findById(user_id)
          .select("name email role school courses disciplines")
          .lean();
      } else if (isStudent || isAdmin) {
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
