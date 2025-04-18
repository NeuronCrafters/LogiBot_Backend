import { AppError } from "../../../exceptions/AppError";
import { User } from "../../../models/User";
import { Discipline } from "../../../models/Discipline";
import { Types } from "mongoose";

class AssignDisciplineService {
  async assignDiscipline(studentId: string, disciplineId: string) {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new AppError("ID do aluno inválido!", 400);
    }
    const studentObjectId = new Types.ObjectId(studentId);

    if (!Types.ObjectId.isValid(disciplineId)) {
      throw new AppError("ID da disciplina inválido!", 400);
    }
    const disciplineObjectId = new Types.ObjectId(disciplineId);

    const student = await User.findById(studentObjectId);
    if (!student || !student.role.includes("student")) {
      throw new AppError("Aluno não encontrado ou não é válido.", 404);
    }

    const discipline = await Discipline.findById(disciplineObjectId);
    if (!discipline) {
      throw new AppError("Disciplina não encontrada.", 404);
    }

    if (!discipline.classes.some((classId) => classId.equals(student.class))) {
      throw new AppError("A disciplina não pertence à turma do aluno.", 400);
    }

    if (!discipline.students.some((id) => id.equals(studentObjectId))) {
      discipline.students.push(studentObjectId);
      await discipline.save();
    }

    if (!student.disciplines.some((id) => id.equals(disciplineObjectId))) {
      student.disciplines.push(disciplineObjectId);
      await student.save();
    }

    return {
      message: "Aluno associado à disciplina com sucesso.",
      student: {
        id: student._id,
        name: student.name,
      },
      discipline: {
        id: discipline._id,
        name: discipline.name,
      },
    };
  }
}

export { AssignDisciplineService };
