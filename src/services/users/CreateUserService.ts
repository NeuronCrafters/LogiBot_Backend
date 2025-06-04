import { User } from "@/models/User";
import { Discipline } from "@/models/Discipline";
import { Course } from "@/models/Course";
import { Class } from "@/models/Class";
import { University } from "@/models/University";
import { AppError } from "@/exceptions/AppError";
import { hash } from "bcryptjs";
import { findEntitiesByCode } from "@/config/generateCode";

interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  code: string;
}

class CreateUserService {
  async createUser({ name, email, password, code }: CreateUserRequest) {
    // Verificar se já existe usuário com este email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new AppError("Usuário já existe com este email!", 409);
    }

    // Buscar entidades pelo código da disciplina
    const entities = await findEntitiesByCode(code);
    if (!entities) {
      throw new AppError("Código de disciplina inválido!", 404);
    }

    const { university, course, discipline, classes } = entities;

    // Verificar se a disciplina tem turmas
    if (!classes || classes.length === 0) {
      throw new AppError("A disciplina não possui turmas cadastradas!", 400);
    }

    // Para códigos específicos de turma, precisamos identificar qual turma
    // Vamos buscar qual das turmas da disciplina corresponde ao código
    let selectedClass = null;

    // Se há múltiplas turmas, vamos procurar qual turma específica o código representa
    for (const classItem of classes) {
      // Tentar gerar o mesmo código para verificar se corresponde
      const { generateDisciplineCode } = await import("@/config/generateCode");
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

    // Se não encontrou turma específica, usar a primeira
    if (!selectedClass) {
      selectedClass = classes[0];
    }

    // Criptografar a senha
    const hashedPassword = await hash(password, 10);

    // Criar o usuário
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

    // Adicionar o usuário à disciplina
    await Discipline.findByIdAndUpdate(discipline._id, {
      $addToSet: { students: user._id }
    });

    // Adicionar o usuário à turma específica
    await Class.findByIdAndUpdate((selectedClass as any)._id, {
      $addToSet: { students: user._id }
    });

    // Retornar dados do usuário (sem a senha) com informações completas
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