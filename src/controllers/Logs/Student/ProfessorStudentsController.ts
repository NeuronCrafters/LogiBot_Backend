// src/controllers/Logs/Student/ProfessorStudentsController.ts
import { Request, Response } from "express";
import { ProfessorStudentsService } from "../../../services/Logs/Student/ProfessorStudentsService";
import { Professor } from "../../../models/Professor";
import { isProfessor, isCourseCoordinator } from "../../../utils/RoleChecker";

/**
 * Controller para listar todos os alunos das disciplinas do professor
 */
export async function ProfessorListStudentsController(req: Request, res: Response) {
  console.log("\n========== INÍCIO ProfessorListStudentsController ==========");

  try {
    // 1. Debug dos dados da requisição
    console.log("1️⃣ [CONTROLLER] Dados da requisição:");
    console.log("   - Method:", req.method);
    console.log("   - URL:", req.url);
    console.log("   - Query params:", req.query);
    console.log("   - Headers:", req.headers);
    console.log("   - Cookies:", req.cookies);

    const { disciplineId, classId } = req.query;

    // 2. Debug do usuário autenticado
    console.log("\n2️⃣ [CONTROLLER] Dados do usuário autenticado (req.user):");
    if (req.user) {
      console.log("   - ID:", req.user.id);
      console.log("   - Nome:", req.user.name);
      console.log("   - Email:", req.user.email);
      console.log("   - Role:", req.user.role);
      console.log("   - School:", req.user.school);
      console.log("   - Courses:", req.user.courses);
    } else {
      console.log("   ❌ req.user está undefined!");
    }

    const professorId = req.user?.id;
    const userEmail = req.user?.email;
    const userRole = req.user?.role || [];

    // 3. Debug da verificação de role
    console.log("\n3️⃣ [CONTROLLER] Verificação de permissões:");
    console.log("   - isProfessor:", isProfessor(userRole));
    console.log("   - isCourseCoordinator:", isCourseCoordinator(userRole));

    if (!isProfessor(userRole) && !isCourseCoordinator(userRole)) {
      console.log("   ❌ Usuário não tem permissão!");
      return res.status(403).json({
        message: "Acesso negado. Apenas professores podem acessar esta funcionalidade."
      });
    }

    // 4. Debug da busca do professor
    console.log("\n4️⃣ [CONTROLLER] Buscando professor no banco:");
    console.log("   - Buscando por ID:", professorId);

    let professor = await Professor.findById(professorId)
      .populate('school')
      .populate('courses')
      .populate('disciplines');

    if (!professor) {
      console.log("   ❌ Não encontrado por ID, tentando por email:", userEmail);
      professor = await Professor.findOne({ email: userEmail })
        .populate('school')
        .populate('courses')
        .populate('disciplines');
    }

    if (!professor) {
      console.log("   ❌ Professor não encontrado nem por ID nem por email!");
      return res.status(403).json({
        message: "Professor não encontrado."
      });
    }

    // 5. Debug dos dados do professor
    console.log("\n5️⃣ [CONTROLLER] Professor encontrado:");
    console.log("   - ID:", professor._id);
    console.log("   - Nome:", professor.name);
    console.log("   - Email:", professor.email);
    console.log("   - School:", professor.school?._id || professor.school);
    console.log("   - Courses:", professor.courses?.map((c: any) => c._id || c));
    console.log("   - Disciplines:", professor.disciplines?.map((d: any) => ({
      id: d._id || d,
      name: d.name || 'ID apenas'
    })));

    // 6. Debug antes de chamar o service
    console.log("\n6️⃣ [CONTROLLER] Chamando o service com:");
    console.log("   - professor._id:", professor._id);
    console.log("   - disciplineId:", disciplineId);
    console.log("   - classId:", classId);

    // Chama o service
    const result = await ProfessorStudentsService.getStudentData({
      professor,
      disciplineId: disciplineId as string,
      classId: classId as string
    });

    // 7. Debug do resultado
    console.log("\n7️⃣ [CONTROLLER] Resultado do service:");
    console.log("   - totalCorrectAnswers:", result.totalCorrectAnswers);
    console.log("   - totalWrongAnswers:", result.totalWrongAnswers);
    console.log("   - usageTimeInSeconds:", result.usageTimeInSeconds);
    console.log("   - Tem users?", !!result.users);
    console.log("   - Quantidade de sessions:", result.sessions?.length || 0);
    console.log("   - Quantidade de dailyUsage:", result.dailyUsage?.length || 0);

    console.log("\n✅ [CONTROLLER] Retornando resposta com sucesso");
    console.log("========== FIM ProfessorListStudentsController ==========\n");

    return res.status(200).json(result);
  } catch (error) {
    console.error("\n❌ [CONTROLLER] ERRO:", error);
    console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
    console.log("========== FIM ProfessorListStudentsController (com erro) ==========\n");

    return res.status(500).json({
      message: "Erro ao listar alunos.",
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
}

/**
 * Controller para obter dados de um aluno específico
 */
export async function ProfessorGetStudentDetailsController(req: Request, res: Response) {
  console.log("\n========== INÍCIO ProfessorGetStudentDetailsController ==========");

  try {
    const { studentId } = req.params;
    const { disciplineId, classId } = req.query;

    console.log("1️⃣ [CONTROLLER] Parâmetros recebidos:");
    console.log("   - studentId:", studentId);
    console.log("   - disciplineId:", disciplineId);
    console.log("   - classId:", classId);
    console.log("   - req.user:", req.user);

    if (!studentId) {
      console.log("   ❌ ID do aluno não fornecido!");
      return res.status(400).json({
        message: "ID do aluno é obrigatório."
      });
    }

    const professorId = req.user?.id;
    const userEmail = req.user?.email;
    const userRole = req.user?.role || [];

    if (!isProfessor(userRole) && !isCourseCoordinator(userRole)) {
      console.log("   ❌ Usuário não tem permissão!");
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
      console.log("   ❌ Professor não encontrado!");
      return res.status(403).json({
        message: "Professor não encontrado."
      });
    }

    console.log("2️⃣ [CONTROLLER] Professor encontrado, chamando service...");

    const result = await ProfessorStudentsService.getStudentData({
      professor,
      studentId,
      disciplineId: disciplineId as string,
      classId: classId as string
    });

    if (result.message && result.message.includes("não encontrado")) {
      console.log("   ⚠️ Aluno não encontrado ou sem permissão");
      return res.status(404).json({
        message: result.message
      });
    }

    console.log("✅ [CONTROLLER] Retornando dados do aluno");
    console.log("========== FIM ProfessorGetStudentDetailsController ==========\n");

    return res.status(200).json(result);
  } catch (error) {
    console.error("\n❌ [CONTROLLER] ERRO:", error);
    console.log("========== FIM ProfessorGetStudentDetailsController (com erro) ==========\n");

    return res.status(500).json({
      message: "Erro ao obter detalhes do aluno."
    });
  }
}

/**
 * Controller para obter estatísticas gerais
 */
export async function ProfessorStudentsStatsController(req: Request, res: Response) {
  console.log("\n========== INÍCIO ProfessorStudentsStatsController ==========");

  try {
    const { disciplineId, classId } = req.query;
    const professorId = req.user?.id;
    const userEmail = req.user?.email;
    const userRole = req.user?.role || [];

    console.log("1️⃣ [CONTROLLER] Dados recebidos:");
    console.log("   - Filtros:", { disciplineId, classId });
    console.log("   - Professor ID:", professorId);

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
      return res.status(403).json({
        message: "Professor não encontrado."
      });
    }

    const result = await ProfessorStudentsService.getStudentData({
      professor,
      disciplineId: disciplineId as string,
      classId: classId as string
    });

    console.log("✅ [CONTROLLER] Retornando estatísticas");
    console.log("========== FIM ProfessorStudentsStatsController ==========\n");

    return res.status(200).json(result);
  } catch (error) {
    console.error("\n❌ [CONTROLLER] ERRO:", error);
    console.log("========== FIM ProfessorStudentsStatsController (com erro) ==========\n");

    return res.status(500).json({
      message: "Erro ao obter estatísticas dos alunos."
    });
  }
}