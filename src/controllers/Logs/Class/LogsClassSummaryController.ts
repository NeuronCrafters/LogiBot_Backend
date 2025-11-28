import { Request, Response } from "express";
import { LogsClassSummaryService } from "../../../services/Logs/Class/LogsClassSummaryService";
import { Professor } from "../../../models/Professor";
import { Class } from "../../../models/Class";
import { Discipline } from "../../../models/Discipline";
import { isAdmin, isCourseCoordinator, isProfessor } from "../../../utils/RoleChecker";

export async function LogsClassSummaryController(req: Request, res: Response) {
  try {
    const { classId } = req.params;
    const userRole: string[] = req.user.role;
    const userId = req.user.id;

    if (!classId) {
      return res.status(400).json({ message: "O ID da turma é obrigatório." });
    }

    if (isAdmin(userRole)) {
      const summary = await LogsClassSummaryService(classId);
      return res.status(200).json(summary);
    }

    const professor = await Professor.findById(userId);
    if (!professor) return res.status(403).json({ message: "Professor não encontrado." });

    const classObj = await Class.findById(classId);
    if (!classObj) return res.status(404).json({ message: "Turma não encontrada." });

    const courseId = classObj.course;

    if (isCourseCoordinator(userRole)) {
      if (professor.courses.some(c => c.equals(courseId))) {
        const summary = await LogsClassSummaryService(classId);
        return res.status(200).json(summary);
      }
    }

    if (isProfessor(userRole)) {
      const disciplines = await Discipline.find({
        _id: { $in: professor.disciplines },
        classes: classId
      });

      if (disciplines.length > 0) {
        const summary = await LogsClassSummaryService(classId);
        return res.status(200).json(summary);
      }
    }

    return res.status(403).json({ message: "Acesso negado." });
  } catch (error) {
    console.error("[logsclasssummarycontroller] erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados da turma." });
  }
}
