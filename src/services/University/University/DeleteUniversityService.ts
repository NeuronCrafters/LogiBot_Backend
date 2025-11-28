import { University } from "../../../models/University";
import { Course } from "../../../models/Course";
import { Class } from "../../../models/Class";
import { Discipline } from "../../../models/Discipline";
import { User } from "../../../models/User";
import { AppError } from "../../../exceptions/AppError";
import { Types } from "mongoose";

class DeleteUniversityService {
  async execute(universityId: string) {
    if (!Types.ObjectId.isValid(universityId)) {
      throw new AppError("id da universidade inválido!", 400);
    }

    const university = await University.findById(universityId);
    if (!university) {
      throw new AppError("universidade não encontrada!", 404);
    }

    const courses = await Course.find({ university: universityId }).select('_id');
    const courseIds = courses.map((course) => course._id);

    await Promise.all([
      Course.deleteMany({ university: universityId }),
      Class.deleteMany({ course: { $in: courseIds } }),
      Discipline.deleteMany({ course: { $in: courseIds } }),
      User.deleteMany({ role: "student", course: { $in: courseIds } }),
      User.deleteMany({ role: "professor", university: university._id })
    ]);

    await University.findByIdAndDelete(universityId);

    return { message: "Universidade e todos os dados relacionados foram removidos com sucesso!" };
  }
}

export { DeleteUniversityService };
