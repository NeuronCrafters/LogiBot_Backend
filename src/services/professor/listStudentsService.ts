import { Professor } from "../../models/Professor";
import { IUser } from "../../models/User";

interface ListStudentsResponse {
  id: string;
  name: string;
  email: string;
  role: string[];
  school: string;
}

class ListStudentsService {
  async execute(professorId: string): Promise<ListStudentsResponse[]> {
    try {
      const professor = await Professor.findById(professorId).populate("students");

      if (!professor) {
        throw new Error("Professor não encontrado.");
      }

      const students = professor.students as unknown as IUser[];

      return students.map((student) => ({
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        role: student.role,
        school: student.school,
      }));
    } catch (error) {
      console.error("Erro ao listar alunos:", error);
      throw new Error("Erro ao listar alunos.");
    }
  }
}

export { ListStudentsService };
