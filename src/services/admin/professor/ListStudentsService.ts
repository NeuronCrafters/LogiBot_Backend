import { User, IUser } from "../../../models/User";
import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError";

interface ListStudentsInput {
  requesterId: string;
  requesterRole: string[] | string;
}

class ListStudentsService {
  async execute({ requesterId, requesterRole }: ListStudentsInput): Promise<IUser[]> {
    const roles = Array.isArray(requesterRole) ? requesterRole : [requesterRole];

    try {
      if (roles.includes("admin")) {
        return await User.find({ role: { $in: ["student"] } })
          .select("name email course class disciplines")
          .populate({
            path: "disciplines",
            select: "name code professors",
            populate: {
              path: "professors",
              select: "name email"
            }
          })
          .lean();
      }

      if (roles.includes("course-coordinator")) {
        const coordinator = await Professor.findById(requesterId).lean();
        if (!coordinator) throw new AppError("Coordenador não encontrado.", 404);

        return await User.find({
          role: { $in: ["student"] },
          course: { $in: coordinator.courses }
        })
          .select("name email course class disciplines")
          .populate({
            path: "disciplines",
            select: "name code professors",
            populate: {
              path: "professors",
              select: "name email"
            }
          })
          .lean();
      }

      if (roles.includes("professor")) {
        const professor = await Professor.findById(requesterId).lean();
        if (!professor) throw new AppError("Professor não encontrado.", 404);

        return await User.find({
          role: { $in: ["student"] },
          disciplines: { $exists: true, $ne: [] }
        })
          .select("name email disciplines")
          .populate({
            path: "disciplines",
            match: { professors: requesterId },
            select: "name code"
          })
          .lean();
      }

      throw new AppError("Acesso negado. Permissão insuficiente.", 403);
    } catch (error) {
      console.error("Erro ao listar alunos:", error);
      if (error instanceof AppError) throw error;
      throw new AppError("Erro interno ao processar a listagem de alunos.", 500);
    }
  }
}

export { ListStudentsService };
