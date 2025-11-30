import { User } from "@/models/User";
import { Discipline } from "@/models/Discipline";
import { Course } from "@/models/Course";
import { Class } from "@/models/Class";
import { University } from "@/models/University";
import { AppError } from "@/exceptions/AppError";
import { hash } from "bcryptjs";
import { findEntitiesByCode, generateDisciplineCode } from "@/config/generateCode";

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  code: string;
}

class CreateUserService {
  async createUser({ name, email, password, code }: CreateUserRequest) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError("usuário já existe com este email!", 409);
    }

    const entities = await findEntitiesByCode(code);
    if (!entities) {
      throw new AppError("código de disciplina inválido!", 404);
    }

    const { university, course, discipline, classes } = entities;

    if (!classes || classes.length === 0) {
      throw new AppError("a disciplina não possui turmas cadastradas!", 400);
    }

    let selectedClass = null;

    for (const classItem of classes) {
      const testCode = generateDisciplineCode(
        university._id.toString(),
        course._id.toString(),
        (classItem as any)._id.toString(),
        discipline._id.toString()
      );

      if (testCode === code) {
        selectedClass = classItem;
        break;
      }
    }

    if (!selectedClass) {
      selectedClass = classes[0];
    }

    const hashedPassword = await hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      school: university._id,
      course: course._id,
      class: (selectedClass as any)._id,
      disciplines: [discipline._id],
      role: ["student"],
      status: "active"
    });

    await Discipline.findByIdAndUpdate(discipline._id, {
      $addToSet: { students: user._id }
    });

    await Class.findByIdAndUpdate((selectedClass as any)._id, {
      $addToSet: { students: user._id }
    });

    const userResponse = await User.findById(user._id)
      .populate('school', 'name')
      .populate('course', 'name')
      .populate('class', 'name')
      .populate('disciplines', 'name code')
      .select('-password');

    return {
      user: userResponse,
      assignedClass: {
        id: (selectedClass as any)._id,
        name: (selectedClass as any).name
      },
      discipline: {
        id: discipline._id,
        name: discipline.name
      },
      course: {
        id: course._id,
        name: course.name
      },
      university: {
        id: university._id,
        name: university.name
      }
    };
  }
}

export { CreateUserService };
