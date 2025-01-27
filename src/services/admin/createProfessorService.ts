import { Professor } from "../../models/Professor";
import { Course } from "../../models/Course";
import { AppError } from "../../exceptions/AppError";
import { hash } from "bcryptjs";

interface CreateProfessorDTO {
  name: string;
  email: string;
  password: string;
  courses: string[];
  school: string;
}

class createProfessorService {
  async create({ name, email, password, courses, school }: CreateProfessorDTO) {

    const existingProfessor = await Professor.findOne({ email });
    if (existingProfessor) {
      throw new AppError("Já existe um professor com este email!", 409);
    }

    const courseData = await Course.find({ _id: { $in: courses }, university: school });
    if (courseData.length !== courses.length) {
      throw new AppError("Um ou mais cursos fornecidos não foram encontrados nesta universidade.", 404);
    }

    const hashedPassword = await hash(password, 10);

    const newProfessor = await Professor.create({
      name,
      email,
      password: hashedPassword,
      role: ["professor"],
      school,
      courses,
    });

    return newProfessor;
  }
}

export { createProfessorService };
