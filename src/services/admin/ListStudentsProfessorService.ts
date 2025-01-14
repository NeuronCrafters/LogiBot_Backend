import { Professor } from "../../models/Professor";
import { IUser } from "../../models/User";

class ListStudentsProfessorService {
  async execute(professorId: string): Promise<any> {
    try {
      const professor = await Professor.findById(professorId).populate<{
        students: IUser[];
      }>("students");

      if (!professor) {
        throw new Error("Professor não encontrado.");
      }

      return {
        id: professor._id.toString(),
        name: professor.name,
        email: professor.email,
        role: professor.role,
        school: professor.school,
        alunos: professor.students.map((student) => ({
          id: student._id.toString(),
          name: student.name,
          email: student.email,
          role: student.role,
          school: student.school,
        })),
      };
    } catch (error) {
      console.error("Erro ao listar alunos do professor:", error);
      throw new Error("Erro ao listar alunos do professor.");
    }
  }
}

export { ListStudentsProfessorService };
