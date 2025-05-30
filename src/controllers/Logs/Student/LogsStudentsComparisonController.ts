import { Request, Response } from "express";
import { LogsStudentsComparisonService } from "../../../services/Logs/Student/LogsStudentsComparisonService";
import { Professor } from "../../../models/Professor";
import { Discipline } from "../../../models/Discipline";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { Types } from "mongoose";

export async function LogsStudentsComparisonController(req: Request, res: Response) {
  try {
    const { studentId1, studentId2, classId } = req.body;
    const userId = req.user.id;
    const userRole: string[] = req.user.role;

    if (!studentId1 || !studentId2 || !classId) {
      return res.status(400).json({
        message: "Os IDs dos dois alunos e da turma são obrigatórios."
      });
    }

    // Verificar se os alunos existem e estão na mesma turma
    const student1Analysis = await UserAnalysis.findOne({ userId: studentId1, classId });
    const student2Analysis = await UserAnalysis.findOne({ userId: studentId2, classId });

    if (!student1Analysis || !student2Analysis) {
      return res.status(404).json({
        message: "Um ou ambos os alunos não foram encontrados na turma especificada."
      });
    }

    // Permissões
    if (userRole.includes("admin")) {
      const comparison = await LogsStudentsComparisonService(studentId1, studentId2, classId);
      return res.status(200).json(comparison);
    }

    const professor = await Professor.findOne({ userId });
    if (!professor) {
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const isCoordinator = professor.role.includes("course-coordinator");

    // Se é coordenador, verifica se tem acesso ao curso da turma
    if (isCoordinator) {
      const courseId = student1Analysis.courseId;
      const courseObjectId = new Types.ObjectId(courseId);
      const hasCourseAccess = professor.courses.some(c => c.equals(courseObjectId));

      if (hasCourseAccess) {
        const comparison = await LogsStudentsComparisonService(studentId1, studentId2, classId);
        return res.status(200).json(comparison);
      }
    }

    // Se é professor regular, verifica se leciona na turma
    const isProfessor = professor.role.includes("professor");

    if (isProfessor) {
      const disciplinesInClass = await Discipline.find({
        _id: { $in: professor.disciplines },
        classes: classId
      });

      if (disciplinesInClass.length > 0) {
        const comparison = await LogsStudentsComparisonService(studentId1, studentId2, classId);
        return res.status(200).json(comparison);
      }
    }

    return res.status(403).json({
      message: "Acesso negado. Você não tem permissão para comparar estes alunos."
    });
  } catch (error) {
    console.error("[LogsStudentsComparisonController] Erro:", error);
    return res.status(500).json({
      message: "Erro ao comparar alunos."
    });
  }
}