import { Class } from "../../../models/Class";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "mongoose";

class DeleteClassService {
  async deleteClass(classId: string) {
    if (!Types.ObjectId.isValid(classId)) {
      throw new AppError("id da turma inválido!", 400);
    }

    const classDoc = await Class.findById(classId);
    if (!classDoc) {
      throw new AppError("turma não encontrada!", 404);
    }

    await Class.findOneAndDelete({ _id: classId });

    return { message: "Turma removida com sucesso!" };
  }
}

export { DeleteClassService };
