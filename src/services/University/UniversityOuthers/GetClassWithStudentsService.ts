import { Class } from "../../../models/Class";
import { User } from "../../../models/User";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "mongoose";

class GetClassWithStudentsService {
  async execute(classId: string) {
    if (!Types.ObjectId.isValid(classId)) {
      throw new AppError("ID da turma inválido!", 400);
    }

    const classData = await Class.findById(classId).populate("students", "name email");
    if (!classData) {
      throw new AppError("Turma não encontrada.", 404);
    }

    const students = await User.find({ class: classId }, "name email");

    return {
      id: classData._id,
      name: classData.name,
      course: classData.course,
      students,
    };
  }
}

export { GetClassWithStudentsService };
