import { User } from "../../../models/User";
import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError"; // Supondo que você tenha essa classe

interface IRequest {
  classId: string;
  requesterId: string;
  requesterRole: string[];
  disciplineId?: string; // Filtro opcional de disciplina específica
}

class ListStudentsByClassService {
  async execute({ classId, requesterId, requesterRole, disciplineId }: IRequest) {

    // 1. Definição básica da query: Buscar alunos daquela turma
    // "class" no model User é um ObjectId único, então a busca é direta
    let query: any = {
      role: "student",
      class: classId
    };

    // 2. Lógica para PROFESSOR
    if (requesterRole.includes("professor") && !requesterRole.includes("admin")) {

      // Buscar o professor para saber quais disciplinas ele dá
      const professor = await Professor.findById(requesterId).select("disciplines");

      if (!professor) {
        throw new AppError("Professor não encontrado", 404);
      }

      // Se o filtro veio com uma disciplina específica (para não misturar)
      if (disciplineId) {
        // Validação de Segurança: O professor realmente dá essa disciplina?
        const teachesDiscipline = professor.disciplines.some(
          (d) => d.toString() === disciplineId
        );

        if (!teachesDiscipline) {
          throw new AppError("Você não tem permissão para visualizar alunos desta disciplina.", 403);
        }

        // Filtra alunos que estão na turma E especificamente nessa disciplina
        query.disciplines = disciplineId;

      } else {
        // Se não selecionou disciplina, mostra alunos da turma que fazem QUALQUER disciplina do professor
        // Isso evita que o professor veja alunos da turma que só fazem matéria com OUTROS professores
        query.disciplines = { $in: professor.disciplines };
      }
    }

    // 3. Lógica para ADMIN ou COORDENADOR (se quiser filtrar por disciplina também)
    else if (disciplineId) {
      query.disciplines = disciplineId;
    }

    // 4. Executa a busca no Banco
    const students = await User.find(query)
      .select("name email disciplines class photo") // Selecione os campos necessários
      .populate({
        path: "disciplines",
        select: "name code", // Popula para mostrar quais disciplinas o aluno faz
      })
      .lean();

    return students;
  }
}

export { ListStudentsByClassService };