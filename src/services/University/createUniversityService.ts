import { University } from "../../models/University";
import { AppError } from "../../exceptions/AppError";

class createUniversityService {
  async create(name: string) {
    const existingUniversity = await University.findOne({ name });
    if (existingUniversity) {
      throw new AppError("Universidade já existe!", 409);
    }
    const university = await University.create({ name });
    return university;
  }

  async list() {
    const universities = await University.find();
    return universities;
  }
}

export { createUniversityService };
