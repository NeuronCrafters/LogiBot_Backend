import { Discipline } from "../../../models/Discipline";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "mongoose";

class DeleteDisciplineService {
  async execute(disciplineId: string) {
    if (!Types.ObjectId.isValid(disciplineId)) {
      throw new AppError("id da disciplina inválido!", 400);
    }

    const discipline = await Discipline.findById(disciplineId);
    if (!discipline) {
      throw new AppError("disciplina não encontrada!", 404);
    }

    await Discipline.findOneAndDelete({ _id: disciplineId });

    return { message: "Disciplina excluída com sucesso!" };
  }
}

export { DeleteDisciplineService };
