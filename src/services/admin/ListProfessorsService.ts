import { Professor } from "../../models/Professor";

class ListProfessorsService {
  async execute(): Promise<any[]> {
    try {
      const professors = await Professor.find();
      return professors.map((professor) => ({
        id: professor._id.toString(),
        name: professor.name,
        email: professor.email,
        role: professor.role,
      }));
    } catch (error) {
      throw new Error("Erro ao listar professores.");
    }
  }
}

export { ListProfessorsService };
