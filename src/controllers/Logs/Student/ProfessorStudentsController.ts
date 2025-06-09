import { Request, Response } from "express";
import { ProfessorStudentsService } from "../../../services/Logs/Student/ProfessorStudentsService";
import { Professor } from "../../../models/Professor";
import { isProfessor, isCourseCoordinator } from "../../../utils/RoleChecker";

/**
 * Controller para listar dados agregados dos alunos do professor
 */
export async function ProfessorListStudentsController(req: Request, res: Response) {
  try {
    const { disciplineId, classId } = req.query;
    const professorId = req.user?.id;
    const userEmail = req.user?.email;
    const userRole = req.user?.role || [];

    if (!isProfessor(userRole) && !isCourseCoordinator(userRole)) {
      return res.status(403).json({
        message: "Acesso negado. Apenas professores podem acessar esta funcionalidade."
      });
    }

    let professor = await Professor.findById(professorId)
      .populate('school')
      .populate('courses')
      .populate('disciplines');

    if (!professor) {
      professor = await Professor.findOne({ email: userEmail })
        .populate('school')
        .populate('courses')
        .populate('disciplines');
    }

    if (!professor) {
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const result = await ProfessorStudentsService.getStudentData({
      professor,
      disciplineId: disciplineId as string,
      classId: classId as string
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao listar alunos." });
  }
}

/**
 * Controller para obter dados de um aluno específico
 */
export async function ProfessorGetStudentDetailsController(req: Request, res: Response) {
  try {
    const { studentId } = req.params;
    const { disciplineId, classId } = req.query;
    const professorId = req.user?.id;
    const userEmail = req.user?.email;
    const userRole = req.user?.role || [];

    if (!studentId) {
      return res.status(400).json({ message: "ID do aluno é obrigatório." });
    }

    if (!isProfessor(userRole) && !isCourseCoordinator(userRole)) {
      return res.status(403).json({
        message: "Acesso negado. Apenas professores podem acessar esta funcionalidade."
      });
    }

    let professor = await Professor.findById(professorId)
      .populate('school')
      .populate('courses')
      .populate('disciplines');

    if (!professor) {
      professor = await Professor.findOne({ email: userEmail })
        .populate('school')
        .populate('courses')
        .populate('disciplines');
    }

    if (!professor) {
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const result = await ProfessorStudentsService.getStudentData({
      professor,
      studentId,
      disciplineId: disciplineId as string,
      classId: classId as string
    });

    if (result.message?.includes("não encontrado")) {
      return res.status(404).json({ message: result.message });
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao obter detalhes do aluno." });
  }
}

/**
 * Controller para obter estatísticas gerais dos alunos
 */
export async function ProfessorStudentsStatsController(req: Request, res: Response) {
  try {
    const { disciplineId, classId } = req.query;
    const professorId = req.user?.id;
    const userEmail = req.user?.email;
    const userRole = req.user?.role || [];

    if (!isProfessor(userRole) && !isCourseCoordinator(userRole)) {
      return res.status(403).json({
        message: "Acesso negado. Apenas professores podem acessar esta funcionalidade."
      });
    }

    let professor = await Professor.findById(professorId)
      .populate('school')
      .populate('courses')
      .populate('disciplines');

    if (!professor) {
      professor = await Professor.findOne({ email: userEmail })
        .populate('school')
        .populate('courses')
        .populate('disciplines');
    }

    if (!professor) {
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const result = await ProfessorStudentsService.getStudentData({
      professor,
      disciplineId: disciplineId as string,
      classId: classId as string
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: "Erro ao obter estatísticas dos alunos." });
  }
}
