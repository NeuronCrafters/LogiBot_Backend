import { Request, Response } from "express";
import { LogsFilteredStudentSummaryService } from "../../../services/Logs/Student/LogsFilteredStudentSummaryService";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { Professor } from "../../../models/Professor";
import { Discipline } from "../../../models/Discipline";
import { Types } from "mongoose";

export async function LogsFilteredStudentSummaryController(req: Request, res: Response) {
  try {
    const {
      universityId,
      courseId,
      classId,
      studentId
    } = req.body;
    const userId = req.user.id;
    const userRole: string[] = req.user.role;

    console.log("Requisição para filtrar dados de estudante:", {
      universityId, courseId, classId, studentId
    });

    if (!universityId) {
      return res.status(400).json({ message: "O ID da universidade é obrigatório." });
    }

    if (userRole.includes("admin")) {
      console.log("Usuário admin acessando dados");
      const summary = await LogsFilteredStudentSummaryService(
        universityId,
        courseId,
        classId,
        studentId
      );
      return res.status(200).json(summary);
    }

    const professor = await Professor.findOne({ userId });
    if (!professor) {
      console.log("Professor não encontrado para userId:", userId);
      return res.status(403).json({ message: "Professor não encontrado." });
    }

    const isCoordinator = professor.role.includes("course-coordinator");
    const isProfessor = professor.role.includes("professor");

    console.log("Perfil do professor:", {
      isCoordinator, isProfessor, courses: professor.courses
    });

    const courseObjectId = courseId ? new Types.ObjectId(courseId) : null;
    const classObjectId = classId ? new Types.ObjectId(classId) : null;

    if (isCoordinator && courseObjectId && professor.courses.some((c) => c.equals(courseObjectId))) {
      console.log("Coordenador com acesso ao curso solicitado");
      const summary = await LogsFilteredStudentSummaryService(
        universityId,
        courseId,
        classId,
        studentId
      );
      return res.status(200).json(summary);
    }

    if (isProfessor && courseId && classId) {
      console.log("Professor verificando acesso às disciplinas da turma");

      const disciplinas = await Discipline.find({
        _id: { $in: professor.disciplines },
        classes: classId,
      });

      console.log(`Encontradas ${disciplinas.length} disciplinas para o professor na turma`);

      if (disciplinas.length === 0) {
        return res.status(403).json({ message: "Acesso negado. Nenhuma disciplina encontrada." });
      }

      if (studentId) {
        console.log("Verificando acesso ao aluno específico:", studentId);

        // Verificar se o aluno está matriculado em alguma disciplina do professor
        const alunosNasDisciplinas = await UserAnalysis.find({
          userId: studentId,
          schoolId: universityId,
          courseId,
          classId
        });

        console.log(`Encontrados ${alunosNasDisciplinas.length} registros do aluno`);

        if (alunosNasDisciplinas.length === 0) {
          return res.status(403).json({ message: "Acesso negado ao aluno específico." });
        }
      }

      console.log("Professor tem acesso, buscando summary");
      const summary = await LogsFilteredStudentSummaryService(
        universityId,
        courseId,
        classId,
        studentId
      );
      return res.status(200).json(summary);
    }

    console.log("Acesso negado - perfil não tem permissão");
    return res.status(403).json({ message: "Acesso negado." });
  } catch (error) {
    console.error("[LogsFilteredStudentSummaryController] Erro:", error);
    return res.status(500).json({ message: "Erro ao obter dados filtrados do aluno." });
  }
}