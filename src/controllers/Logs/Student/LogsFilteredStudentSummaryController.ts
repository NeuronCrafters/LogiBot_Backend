import { Request, Response } from "express";
import { LogsFilteredStudentSummaryService } from "../../../services/Logs/Student/LogsFilteredStudentSummaryService";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { Professor } from "../../../models/Professor";
import { Discipline } from "../../../models/Discipline";
import { Types } from "mongoose";

export async function LogsFilteredStudentSummaryController(req: Request, res: Response) {
  try {
    const { universityId, courseId, classId } = req.body;
    const userId = req.user.id;
    const userRole: string[] = req.user.role;

    if (!universityId) {
      return res.status(400).json({ message: "O ID da universidade é obrigatório." });
    }

    if (userRole.includes("admin")) {
      const summary = await LogsFilteredStudentSummaryService(universityId, courseId, classId);
      return res.status(200).json(summary);
    }

    const professor = await Professor.findOne({ userId });
    if (!professor) {
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const isCoordinator = professor.role.includes("course-coordinator");
    const isProfessor = professor.role.includes("professor");

    const courseObjectId = courseId ? new Types.ObjectId(courseId) : null;
    const classObjectId = classId ? new Types.ObjectId(classId) : null;

    if (isCoordinator && courseObjectId && professor.courses.some((c) => c.equals(courseObjectId))) {
      const summary = await LogsFilteredStudentSummaryService(universityId, courseId, classId);
      return res.status(200).json(summary);
    }

    if (isProfessor && courseId && classId) {
      const alunos = await UserAnalysis.find({
        schoolId: universityId,
        courseId,
        classId,
      });

      if (alunos.length === 0) {
        return res.status(404).json({ message: "Nenhum aluno encontrado para os filtros." });
      }

      const alunoIds = alunos.map((a) => a._id);

      const disciplinas = await Discipline.find({
        _id: { $in: professor.disciplines },
        classes: classId,
        students: { $in: alunoIds },
      });

      if (disciplinas.length === 0) {
        return res.status(403).json({ message: "Acesso negado. Nenhum aluno autorizado encontrado." });
      }

      const summary = await LogsFilteredStudentSummaryService(universityId, courseId, classId);
      return res.status(200).json(summary);
    }

    return res.status(403).json({ message: "Acesso negado." });
  } catch (error) {
    console.error("[LogsFilteredStudentSummaryController] Erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados filtrados do aluno." });
  }
}
