import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "@/types/UuidCompat";

class DeleteProfessorService {
  async execute(professorId: string) {
    if (!Types.Uuid.isValid(professorId)) {
      throw new AppError("id do professor inválido!", 400);
    }

    const professor = await Professor.findById(professorId);
    if (!professor) {
      throw new AppError("professor não encontrado!", 404);
    }

    await Professor.findOneAndDelete({ _id: professorId });

    return { message: "Professor removido com sucesso!" };
  }
}

export { DeleteProfessorService };
