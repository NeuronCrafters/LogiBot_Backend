import { AppError } from "../../../exceptions/AppError";
import { User } from "../../../models/User";
import { Discipline } from "../../../models/Discipline";
import { Types } from "mongoose";

class AssignDisciplineService {
  async assignDiscipline(studentId: string, disciplineId: string) {
    if (!Types.ObjectId.isValid(studentId)) {
      throw new AppError("ID do aluno inválido!", 400);
    }

    if (!Types.ObjectId.isValid(disciplineId)) {
      throw new AppError("ID da disciplina inválido!", 400);
    }

    const studentObjectId = new Types.ObjectId(studentId);
    const disciplineObjectId = new Types.ObjectId(disciplineId);

    const student = await User.findById(studentObjectId);
    if (!student || !student.role.includes("student")) {
      throw new AppError("Aluno não encontrado ou não é válido.", 404);
    }

    const discipline = await Discipline.findById(disciplineObjectId);
    if (!discipline) {
      throw new AppError("Disciplina não encontrada.", 404);
    }

    if (!student.class) {
      throw new AppError("Aluno não está vinculado a nenhuma turma.", 400);
    }

    if (!discipline.classes.some((classId) => classId.equals(student.class))) {
      throw new AppError("A disciplina não pertence à turma do aluno.", 400);
    }

    let updated = false;

    if (!discipline.students.some((id) => id.equals(studentObjectId))) {
      discipline.students.push(studentObjectId);
      updated = true;
    }

    if (!student.disciplines.some((id) => id.equals(disciplineObjectId))) {
      student.disciplines.push(disciplineObjectId);
      updated = true;
    }

    if (updated) {
      await Promise.all([discipline.save(), student.save()]);
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
