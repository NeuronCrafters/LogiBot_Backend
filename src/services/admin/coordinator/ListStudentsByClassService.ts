import { User } from "../../../models/User";
import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError";

interface IRequest {
  classId: string;
  requesterId: string;
  requesterRole: string[];
  disciplineId?: string;
}

class ListStudentsByClassService {
  async execute({ classId, requesterId, requesterRole, disciplineId }: IRequest) {

    // Query inicial: Alunos da turma selecionada
    const query: any = {
      role: "student",
      class: classId
    };

    const isProfessor = requesterRole.includes("professor") && !requesterRole.includes("admin");

    if (isProfessor) {
      // 1. Busca os dados do professor (suas disciplinas)
      const professor = await Professor.findById(requesterId).select("disciplines");

      if (!professor) {
        throw new AppError("Professor não encontrado", 404);
      }

      // 2. Define quais disciplinas usar no filtro
      let targetDisciplines: string[] = [];

      if (disciplineId) {
        // Se o professor selecionou uma disciplina específica no filtro
        const ownsDiscipline = professor.disciplines.some(d => d.toString() === disciplineId);
        if (!ownsDiscipline) {
          throw new AppError("Você não tem permissão nesta disciplina.", 403);
        }
        targetDisciplines = [disciplineId];
      } else {
        // AUTOMÁTICO: Se não selecionou disciplina, pega TODAS as disciplinas do professor.
        // Convertendo ObjectIds para string para garantir compatibilidade
        targetDisciplines = professor.disciplines.map(d => d.toString());
      }

      // 3. A Mágica: Filtra alunos dessa turma que cursam as matérias do professor
      // O aluno precisa ter a disciplina X OU Y OU Z (do professor) na grade dele
      if (targetDisciplines.length > 0) {
        query.disciplines = { $in: targetDisciplines };
      } else {
        // Se o professor não tem disciplinas cadastradas, não deve ver alunos
        return [];
      }
    }
    // Lógica Admin/Coordenador
    else if (disciplineId) {
      query.disciplines = disciplineId;
    }

    // 4. Executa a busca
    const students = await User.find(query)
      .select("name email disciplines class photo")
      .populate("disciplines", "name code") // Popula para exibir os nomes
      .lean();

    return students;
  }
}

export { ListStudentsByClassService };