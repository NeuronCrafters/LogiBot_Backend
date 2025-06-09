import { Request, Response } from "express";
import { ProfessorStudentsService } from "../../../services/Logs/Student/ProfessorStudentsService";
import { Professor } from "../../../models/Professor";
import { isProfessor, isCourseCoordinator } from "../../../utils/RoleChecker";

/**
 * Controller para listar todos os alunos das disciplinas do professor
 */
export async function ProfessorListStudentsController(req: Request, res: Response) {
  try {
    const { disciplineId, classId } = req.query;
    const professorId = req.user.id;
    const userEmail = req.user.email;
    const userRole = req.user.role;

    console.log("[ProfessorListStudentsController] Requisição recebida:", {
      professorId,
      userEmail,
      userRole,
      filters: { disciplineId, classId }
    });

    // Verifica se é professor ou coordenador
    if (!isProfessor(userRole) && !isCourseCoordinator(userRole)) {
      return res.status(403).json({
        message: "Acesso negado. Apenas professores podem acessar esta funcionalidade."
      });
    }

    // Busca o professor
    let professor = await Professor.findById(professorId)
      .populate('school')
      .populate('courses')
      .populate('disciplines');

    if (!professor) {
      console.log("[ProfessorListStudentsController] Buscando professor por email:", userEmail);
      professor = await Professor.findOne({ email: userEmail })
        .populate('school')
        .populate('courses')
        .populate('disciplines');
    }

    if (!professor) {
      return res.status(403).json({
        message: "Professor não encontrado."
      });
    }

    console.log("[ProfessorListStudentsController] Professor encontrado:", {
      id: professor._id,
      name: professor.name,
      email: professor.email,
      disciplinesCount: professor.disciplines.length
    });

    // Chama o service unificado
    const result = await ProfessorStudentsService.getStudentData({
      professor,
      disciplineId: disciplineId as string,
      classId: classId as string
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[ProfessorListStudentsController] Erro:", error);
    return res.status(500).json({
      message: "Erro ao listar alunos."
    });
  }
}

/**
 * Controller para obter dados de um aluno específico
 */
export async function ProfessorGetStudentDetailsController(req: Request, res: Response) {
  try {
    const { studentId } = req.params;
    const { disciplineId, classId } = req.query;
    const professorId = req.user.id;
    const userEmail = req.user.email;
    const userRole = req.user.role;

    console.log("[ProfessorGetStudentDetailsController] Requisição recebida:", {
      professorId,
      userEmail,
      userRole,
      studentId,
      filters: { disciplineId, classId }
    });

    // Validação básica
    if (!studentId) {
      return res.status(400).json({
        message: "ID do aluno é obrigatório."
      });
    }

    // Verifica se é professor ou coordenador
    if (!isProfessor(userRole) && !isCourseCoordinator(userRole)) {
      return res.status(403).json({
        message: "Acesso negado. Apenas professores podem acessar esta funcionalidade."
      });
    }

    // Busca o professor
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
      return res.status(403).json({
        message: "Professor não encontrado."
      });
    }

    // Chama o service unificado com studentId
    const result = await ProfessorStudentsService.getStudentData({
      professor,
      studentId,
      disciplineId: disciplineId as string,
      classId: classId as string
    });

    // Verifica se encontrou o aluno
    if (result.message && result.message.includes("não encontrado")) {
      return res.status(404).json({
        message: result.message
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("[ProfessorGetStudentDetailsController] Erro:", error);
    return res.status(500).json({
      message: "Erro ao obter detalhes do aluno."
    });
  }
}

/**
 * Controller para obter estatísticas gerais dos alunos do professor
 */
export async function ProfessorStudentsStatsController(req: Request, res: Response) {
  try {
    const { disciplineId, classId } = req.query;
    const professorId = req.user.id;
    const userEmail = req.user.email;
    const userRole = req.user.role;

    console.log("[ProfessorStudentsStatsController] Requisição recebida:", {
      professorId,
      userEmail,
      userRole,
      filters: { disciplineId, classId }
    });

    // Verifica se é professor ou coordenador
    if (!isProfessor(userRole) && !isCourseCoordinator(userRole)) {
      return res.status(403).json({
        message: "Acesso negado. Apenas professores podem acessar esta funcionalidade."
      });
    }

    // Busca o professor
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
      return res.status(403).json({
        message: "Professor não encontrado."
      });
    }

    // Chama o service unificado sem studentId (retorna agregado)
    const result = await ProfessorStudentsService.getStudentData({
      professor,
      disciplineId: disciplineId as string,
      classId: classId as string
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error("[ProfessorStudentsStatsController] Erro:", error);
    return res.status(500).json({
      message: "Erro ao obter estatísticas dos alunos."
    });
  }
}