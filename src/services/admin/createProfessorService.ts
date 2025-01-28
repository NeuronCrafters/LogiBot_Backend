import { Professor } from "../../models/Professor";
import { Course } from "../../models/Course";
import { AppError } from "../../exceptions/AppError";
import { Types } from "mongoose";
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
    const courseObjects = await Course.find({ _id: { $in: courses } });
    if (courseObjects.length !== courses.length) {
      throw new AppError("Um ou mais cursos não foram encontrados.", 404);
    }

    const hashedPassword = await hash(password, 10);

    const newProfessor = await Professor.create({
      name,
      email,
      password: hashedPassword,
      role: ["professor"],
      school,
      courses: courses.map((courseId) => new Types.ObjectId(courseId)),
    });

    for (const course of courseObjects) {
      if (!course.professors.includes(newProfessor._id as Types.ObjectId)) {
        course.professors.push(newProfessor._id as Types.ObjectId);
        await course.save();
      }
    }

    return newProfessor;
  }

  async listByCourse(courseId: string) {
    const course = await Course.findById(courseId).populate("professors", "name email");
    if (!course) {
      throw new AppError("Curso não encontrado.", 404);
    }

    return course.professors;
  }

  async delete(professorId: string) {
    if (!Types.ObjectId.isValid(professorId)) {
      throw new AppError("ID do professor inválido!", 400);
    }

    const professor = await Professor.findById(professorId);
    if (!professor) {
      throw new AppError("Professor não encontrado!", 404);
    }

    await Professor.findOneAndDelete({ _id: professorId });

    return { message: "Professor removido com sucesso!" };
  }
}

export { createProfessorService };
