import { Request, Response } from "express";
import { LogsFilteredStudentSummaryService } from "../../../services/Logs/Student/LogsFilteredStudentSummaryService";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { Professor } from "../../../models/Professor";
import { Discipline } from "../../../models/Discipline";
import { Types } from "mongoose";
import { isAdmin, isCourseCoordinator, isProfessor } from "../../../utils/RoleChecker";

export async function LogsFilteredStudentSummaryController(req: Request, res: Response) {
  try {
    const { universityId, courseId, classId, studentId } = req.body;
    const userId = req.user.id;
    const userRole: string[] = req.user.role;

    console.log("Requisição para filtrar dados de estudante:", {
      universityId, courseId, classId, studentId
    });

    if (!universityId) {
      return res.status(400).json({ message: "O ID da universidade é obrigatório." });
    }

    // Admin pode tudo
    if (isAdmin(userRole)) {
      const summary = await LogsFilteredStudentSummaryService(
        universityId, courseId, classId, studentId
      );
      return res.status(200).json(summary);
    }

    const professor = await Professor.findOne({ userId });
    if (!professor) {
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const courseObjectId = courseId ? new Types.ObjectId(courseId) : null;
    const classObjectId = classId ? new Types.ObjectId(classId) : null;

    // Coordenador de curso
    if (isCourseCoordinator(userRole) && courseObjectId) {
      if (professor.courses.some(c => c.equals(courseObjectId))) {
        const summary = await LogsFilteredStudentSummaryService(
          universityId, courseId, classId, studentId
        );
        return res.status(200).json(summary);
      }
    }

    // Professor comum (disciplinas)
    if (isProfessor(userRole) && courseId && classId) {
      const disciplinas = await Discipline.find({
        _id: { $in: professor.disciplines },
        classes: classId
      });

      if (disciplinas.length === 0) {
        return res.status(403).json({ message: "Acesso negado. Nenhuma disciplina encontrada." });
      }

      // Se houver filtro de aluno, verificar se o aluno pertence à turma
      if (studentId) {
        const aluno = await UserAnalysis.findOne({
          userId: studentId,
          schoolId: universityId,
          courseId,
          classId
        });

        if (!aluno) {
          return res.status(403).json({ message: "Acesso negado ao aluno específico." });
        }
      }

      const summary = await LogsFilteredStudentSummaryService(
        universityId, courseId, classId, studentId
      );
      return res.status(200).json(summary);
    }

    return res.status(403).json({ message: "Acesso negado." });
  } catch (error) {
    console.error("[LogsFilteredStudentSummaryController] Erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados filtrados do aluno." });
  }
}
