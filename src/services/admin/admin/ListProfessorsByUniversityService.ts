import { Professor } from "../../../models/Professor";
import { AppError } from "../../../exceptions/AppError";

class ListProfessorsByUniversityService {
  async execute(schoolId: string) {
    const professors = await Professor.find({ school: schoolId }).select("name email role school courses");

    if (!professors || professors.length === 0) {
      throw new AppError("nenhum professor encontrado para essa universidade.", 404);
    }

    return professors;
  }
}

export { ListProfessorsByUniversityService };
