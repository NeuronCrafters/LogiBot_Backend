import { AppError } from "../../exceptions/AppError";
import { User } from "../../models/User";
import { Discipline, IDiscipline } from "../../models/Discipline";
import { Types } from "mongoose";

class AssignDisciplineService {
  async assignDiscipline(studentId: string, disciplineId: string) {
    try {
      // Verificar se o aluno existe
      const student = await User.findById(studentId);
      if (!student || !student.role.includes("student")) {
        throw new AppError("Aluno não encontrado ou não é um aluno válido.", 404);
      }

      // Verificar se a disciplina existe
      const discipline = await Discipline.findById(disciplineId) as IDiscipline;
      if (!discipline) {
        throw new AppError("Disciplina não encontrada.", 404);
      }

      // Garantir que student.class seja tratado como Types.ObjectId
      const studentClassId = new Types.ObjectId(student.class);

      // Verificar se a disciplina está associada à turma do aluno
      if (!discipline.classes.some((classId) => classId.equals(studentClassId))) {
        throw new AppError("A disciplina não está disponível para a turma do aluno.", 400);
      }

      // Associar o aluno à disciplina
      if (!discipline.students.some((studentId) => studentId.equals(student._id as Types.ObjectId))) {
        discipline.students.push(new Types.ObjectId(student._id as Types.ObjectId));
        await discipline.save();
      }

      return {
        message: "Aluno atrelado à disciplina com sucesso.",
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
        },
        discipline: {
          id: discipline._id,
          name: discipline.name,
        },
      };
    } catch (error) {
      console.error("Erro ao atrelar aluno à disciplina:", error);
      throw new AppError(error.message || "Erro ao atrelar aluno à disciplina.", 500);
    }
  }
}

export { AssignDisciplineService };
