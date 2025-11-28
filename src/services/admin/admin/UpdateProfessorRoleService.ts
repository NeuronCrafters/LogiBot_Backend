import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError";

class UpdateProfessorRoleService {
  async execute(professorId: string, action: "add" | "remove") {
    const professor = await Professor.findById(professorId);

    if (!professor) {
      throw new AppError("professor não encontrado", 404);
    }

    const currentRoles = professor.role;

    if (action === "add") {
      if (currentRoles.includes("course-coordinator")) {
        throw new AppError("este professor já é coordenador de curso.", 400);
      }

      const existingCoordinator = await Professor.findOne({
        role: { $in: ["course-coordinator"] },
        courses: { $in: professor.courses },
        school: professor.school,
        _id: { $ne: professorId }
      });

      if (existingCoordinator) {
        throw new AppError("já existe um coordenador para este curso nesta universidade.", 409);
      }

      professor.role.push("course-coordinator");
    }

    if (action === "remove") {
      professor.role = currentRoles.filter(role => role !== "course-coordinator");

      if (!professor.role.includes("professor")) {
        professor.role.push("professor");
      }
    }

    await professor.save();
    return professor;
  }
}

export { UpdateProfessorRoleService };
