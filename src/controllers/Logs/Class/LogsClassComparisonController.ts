import { Request, Response } from "express";
import { LogsClassComparisonService } from "../../../services/Logs/Class/LogsClassComparisonService"
import { Professor } from "../../../models/Professor";
import { Discipline } from "../../../models/Discipline";
import { Class } from "../../../models/Class";

export async function LogsClassesComparisonController(req: Request, res: Response) {
  try {
    const { classId1, classId2 } = req.body;
    const userId = req.user.id;
    const userRole: string[] = req.user.role;

    if (!classId1 || !classId2) {
      return res.status(400).json({
        message: "Os IDs das duas turmas são obrigatórios."
      });
    }

    // Verificar se as turmas existem e são do mesmo curso
    const class1 = await Class.findById(classId1);
    const class2 = await Class.findById(classId2);

    if (!class1 || !class2) {
      return res.status(404).json({
        message: "Uma ou ambas as turmas não foram encontradas."
      });
    }

    // Corrigido: usando course em vez de courseId
    if (!class1.course.equals(class2.course)) {
      return res.status(400).json({
        message: "As turmas devem pertencer ao mesmo curso para comparação."
      });
    }

    // Permissões
    if (userRole.includes("admin")) {
      const comparison = await LogsClassComparisonService(classId1, classId2);
      return res.status(200).json(comparison);
    }

    const professor = await Professor.findOne({ userId });
    if (!professor) {
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const isCoordinator = professor.role.includes("course-coordinator");

    // Se é coordenador, verifica se tem acesso ao curso das turmas
    if (isCoordinator) {
      // Corrigido: usando course em vez de courseId
      const hasCourseAccess = professor.courses.some(c => c.equals(class1.course));

      if (hasCourseAccess) {
        const comparison = await LogsClassComparisonService(classId1, classId2);
        return res.status(200).json(comparison);
      }
    }

    // Se é professor regular, verifica se leciona em ambas as turmas
    const isProfessor = professor.role.includes("professor");

    if (isProfessor) {
      const disciplinesClass1 = await Discipline.find({
        _id: { $in: professor.disciplines },
        classes: classId1
      });

      const disciplinesClass2 = await Discipline.find({
        _id: { $in: professor.disciplines },
        classes: classId2
      });

      if (disciplinesClass1.length > 0 && disciplinesClass2.length > 0) {
        const comparison = await LogsClassComparisonService(classId1, classId2);
        return res.status(200).json(comparison);
      }
    }

    return res.status(403).json({
      message: "Acesso negado. Você não tem permissão para comparar estas turmas."
    });
  } catch (error) {
    console.error("[LogsClassesComparisonController] Erro:", error);
    return res.status(500).json({
      message: "Erro ao comparar turmas."
    });
  }
}