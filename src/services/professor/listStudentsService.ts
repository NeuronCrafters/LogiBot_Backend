import { Professor } from "../../models/Professor";
import { IUser } from "../../models/User";

interface ListStudentsResponse {
  id: string;
  name: string;
  email: string;
  role: string;
}

class ListStudentsService {
  async execute(professorId: string): Promise<ListStudentsResponse[]> {
    try {
      const professor = await Professor.findById(professorId).populate("students");

      if (!professor) {
        throw new Error("Professor não encontrado.");
      }

      return professor.students.map((student: IUser) => ({
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        role: student.role,
      }));
    } catch (error) {
      throw new Error("Erro ao listar alunos.");
    }
  }
}

export { ListStudentsService };
