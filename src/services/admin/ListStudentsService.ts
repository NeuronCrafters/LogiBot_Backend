import { Professor } from "../../models/Professor";
import { IUser } from "../../models/User";

class ListStudentsService {
  async execute(professorId: string): Promise<any[]> {
    try {
      const professor = await Professor.findById(professorId).populate<{
        students: IUser[];
      }>("students");

      if (!professor) {
        throw new Error("Professor não encontrado.");
      }

      return professor.students.map((student) => ({
        id: student._id.toString(),
        name: student.name,
        email: student.email,
        role: student.role,
        school: student.school,
        professor: {
          id: professor._id.toString(),
          name: professor.name,
        },
      }));
    } catch (error) {
      throw new Error("Erro ao listar alunos.");
    }
  }
}

export { ListStudentsService };
