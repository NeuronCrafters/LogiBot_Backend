import { University } from "../../../models/University";
import { AppError } from "../../../exceptions/AppError";

class CreateUniversityService {
  async execute(name: string) {
    const existingUniversity = await University.findOne({ name });
    if (existingUniversity) {
      throw new AppError("universidade já existe!", 409);
    }

    const university = await University.create({ name });
    return university;
  }
}

export { CreateUniversityService };
