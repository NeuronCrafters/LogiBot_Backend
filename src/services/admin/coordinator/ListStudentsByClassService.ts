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

    const query: any = {
      role: "student",
      class: classId
    };

    const isProfessor = requesterRole.includes("professor") && !requesterRole.includes("admin");

    if (isProfessor) {
      const professor = await Professor.findById(requesterId).select("disciplines");

      if (!professor) {
        throw new AppError("professor não encontrado", 404);
      }

      let targetDisciplines: string[] = [];

      if (disciplineId) {
        const ownsDiscipline = professor.disciplines.some(d => d.toString() === disciplineId);
        if (!ownsDiscipline) {
          throw new AppError("você não tem permissão nesta disciplina.", 403);
        }
        targetDisciplines = [disciplineId];
      } else {
        targetDisciplines = professor.disciplines.map(d => d.toString());
      }

      if (targetDisciplines.length > 0) {
        query.disciplines = { $in: targetDisciplines };
      } else {
        return [];
      }
    }

    else if (disciplineId) {
      query.disciplines = disciplineId;
    }

    const students = await User.find(query)
      .select("name email disciplines class photo")
      .populate("disciplines", "name code")
      .lean();

    return students;
  }
}

export { ListStudentsByClassService };