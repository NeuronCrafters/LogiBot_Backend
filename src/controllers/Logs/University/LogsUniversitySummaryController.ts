import { Request, Response } from "express";
import { LogsUniversitySummaryService } from "../../../services/Logs/University/LogsUniversitySummaryService";
import { Professor } from "../../../models/Professor";
import { University } from "../../../models/University";

export async function LogsUniversitySummaryController(req: Request, res: Response) {
  try {
    const { universityId } = req.params;
    const userRole: string[] = req.user.role;
    const userId = req.user.id;

    console.log("Requisição para resumo de universidade:", universityId);

    if (!universityId) {
      return res.status(400).json({ message: "O ID da universidade é obrigatório." });
    }

    // Admin pode tudo
    if (userRole.includes("admin")) {
      console.log("Usuário admin acessando dados");
      const summary = await LogsUniversitySummaryService(universityId);
      return res.status(200).json(summary);
    }

    // Verificar se usuário é coordenador da universidade
    const professor = await Professor.findOne({ userId });
    if (!professor) {
      console.log("Professor não encontrado para userId:", userId);
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const university = await University.findById(universityId);
    if (!university) {
      return res.status(404).json({ message: "Universidade não encontrada." });
    }

    // Verifica se professor é coordenador institucional da universidade
    const isInstitutionalCoordinator = professor.role.includes("institutional-coordinator");
    const professorsUniversityId = professor.school?.toString();
    const requestedUniversityId = university._id.toString();

    console.log("Verificação de permissão:", {
      isInstitutionalCoordinator,
      professorsUniversityId,
      requestedUniversityId
    });

    if (isInstitutionalCoordinator && professorsUniversityId === requestedUniversityId) {
      console.log("Coordenador institucional acessando dados da sua universidade");
      const summary = await LogsUniversitySummaryService(universityId);
      return res.status(200).json(summary);
    }

    console.log("Acesso negado - perfil não tem permissão");
    return res.status(403).json({ message: "Acesso negado. Apenas coordenadores institucionais da universidade têm permissão." });
  } catch (error) {
    console.error("[LogsUniversitySummaryController] Erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados da universidade." });
  }
}