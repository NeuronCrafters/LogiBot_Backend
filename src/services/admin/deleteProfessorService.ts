import { Professor } from "../../models/Professor";
import { AppError } from "../../exceptions/AppError";
import { Types } from "mongoose";

class DeleteProfessorService {
  async execute(professorId: string) {
    if (!Types.ObjectId.isValid(professorId)) {
      throw new AppError("ID do professor inválido!", 400);
    }

    const professor = await Professor.findById(professorId);
    if (!professor) {
      throw new AppError("Professor não encontrado!", 404);
    }

    await Professor.findOneAndDelete({ _id: professorId });

    return { message: "Professor removido com sucesso!" };
  }
}

export { DeleteProfessorService };
