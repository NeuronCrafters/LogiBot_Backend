import { Request, Response } from "express";
import { LogsClassSummaryService } from "../../../services/Logs/Class/LogsClassSummaryService";
import { Professor } from "../../../models/Professor";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { Types } from "mongoose";

export async function LogsClassSummaryController(req: Request, res: Response) {
  try {
    const { classId } = req.params;
    const userId = req.user.id;
    const userRole: string[] = req.user.role;

    console.log("Requisição para resumo de turma:", classId);

    if (!classId) {
      return res.status(400).json({ message: "O ID da turma é obrigatório." });
    }

    // Admin pode tudo
    if (userRole.includes("admin")) {
      console.log("Usuário admin acessando dados");
      const summary = await LogsClassSummaryService(classId);
      return res.status(200).json(summary);
    }

    const professor = await Professor.findOne({ userId });
    if (!professor) {
      console.log("Professor não encontrado para userId:", userId);
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const isCoordinator = professor.role.includes("course-coordinator");
    const classObjectId = new Types.ObjectId(classId);

    console.log("Perfil do professor:", {
      isCoordinator,
      courses: professor.courses.map(c => c.toString())
    });

    // Coordenador pode ver dados se a turma for de um curso que ele coordena
    if (isCoordinator) {
      console.log("Verificando se coordenador coordena o curso da turma");

      // Busca a turma e pega seu courseId
      const alunoDaTurma = await UserAnalysis.findOne({ classId: classObjectId });

      if (alunoDaTurma) {
        const courseIdFromClass = alunoDaTurma.courseId;
        console.log("Curso da turma:", courseIdFromClass);

        const coordenaCurso = professor.courses.some((c) => c.equals(courseIdFromClass));
        console.log("Professor coordena o curso?", coordenaCurso);

        if (coordenaCurso) {
          console.log("Coordenador com acesso ao curso da turma");
          const summary = await LogsClassSummaryService(classId);
          return res.status(200).json(summary);
        }
      } else {
        console.log("Nenhum aluno encontrado para a turma");
      }
    }

    console.log("Acesso negado - perfil não tem permissão");
    return res.status(403).json({ message: "Acesso negado. Apenas coordenadores do curso da turma têm permissão." });
  } catch (error) {
    console.error("[LogsClassSummaryController] Erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados da turma." });
  }
}