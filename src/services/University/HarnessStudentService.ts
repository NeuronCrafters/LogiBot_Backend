import { AppError } from "../../exceptions/AppError";
import { User } from "../../models/User";
import { Discipline } from "../../models/Discipline";
import { Types } from "mongoose";

class HarnessStudent {
  async assignDiscipline(studentId: string, disciplineId: string) {
    try {
      // Verificar se o aluno existe
      const student = await User.findById(studentId);
      if (!student || student.role !== "student") {
        throw new AppError("Aluno não encontrado ou não é um aluno válido.", 404);
      }

      // Verificar se a disciplina existe
      const discipline = await Discipline.findById(disciplineId);
      if (!discipline) {
        throw new AppError("Disciplina não encontrada.", 404);
      }

      // Verificar se a disciplina está associada à turma do aluno
      if (!discipline.classes.some((classId) => classId.equals(student.class))) {
        throw new AppError("A disciplina não está disponível para a turma do aluno.", 400);
      }

      // Associar o aluno à disciplina
      if (!discipline.students.includes(student._id)) {
        discipline.students.push(new Types.ObjectId(student._id));
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
          code: discipline.code,
        },
      };
    } catch (error) {
      console.error("Erro ao atrelar aluno à disciplina:", error);
      throw new AppError(error.message || "Erro ao atrelar aluno à disciplina.", 500);
    }
  }
}

export { HarnessStudent };
