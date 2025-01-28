import { hash } from "bcryptjs";
import { AppError } from "../../exceptions/AppError";
import { User, IUser } from "../../models/User";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { University } from "../../models/University";
import { Discipline } from "../../models/Discipline";
import { Professor } from "../../models/Professor";
import { Types } from "mongoose";

interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  school: string;
  course: string;
  class: string;
}

class CreateUserService {
  async createUser({ name, email, password, school, course, class: className }: CreateUserDTO) {
    // Verificar se o email já está em uso
    const userExists = await User.findOne({ email });
    if (userExists) {
      throw new AppError("Email já está em uso por outro usuário!", 409);
    }

    // Verificar se a universidade existe
    const university = await University.findById(school);
    if (!university) {
      throw new AppError("Universidade não encontrada!", 404);
    }

    // Verificar se o curso existe
    const courseData = await Course.findOne({ _id: course, university: school });
    if (!courseData) {
      throw new AppError("Curso não encontrado na universidade especificada.", 404);
    }

    // Verificar se a turma existe no curso
    const classData = await Class.findOne({ _id: className, course: courseData._id });
    if (!classData) {
      throw new AppError("Turma não encontrada para o curso especificado.", 404);
    }

    // Hash da senha
    const passwordHash = await hash(password, 10);

    // Criar o aluno
    const newStudent = await User.create({
      name,
      email,
      password: passwordHash,
      role: "student",
      school,
      course: courseData._id,
      class: classData._id,
    }) as IUser;

    // Associar o aluno à turma
    if (!classData.students.includes(newStudent._id as Types.ObjectId)) {
      classData.students.push(newStudent._id as Types.ObjectId);
      await classData.save();
    }

    // Buscar disciplinas associadas à turma
    const disciplines = await Discipline.find({ classes: classData._id });

    // Associar disciplinas ao aluno
    if (disciplines.length > 0) {
      const disciplineIds = disciplines.map((discipline) => discipline._id);
      newStudent.disciplines = disciplineIds as Types.ObjectId[]; // Conversão explícita
      await newStudent.save();

      // Associar o aluno aos professores das disciplinas
      const professorIds = disciplines.flatMap((discipline) =>
        (discipline.professors as Types.ObjectId[]).map((profId) => new Types.ObjectId(profId))
      );
      await Professor.updateMany(
        { _id: { $in: professorIds } },
        { $addToSet: { students: newStudent._id } }
      );

      // Associar o aluno às disciplinas (students array)
      for (const discipline of disciplines) {
        if (!discipline.students.some((id) => id.equals(newStudent._id as Types.ObjectId))) {
          discipline.students.push(newStudent._id as Types.ObjectId);
          await discipline.save();
        }
      }
    }

    return {
      id: newStudent._id,
      name: newStudent.name,
      email: newStudent.email,
      role: newStudent.role,
      school: university.name,
      course: courseData.name,
      class: classData.name,
      disciplines: disciplines.map((discipline) => discipline.name),
    };
  }
}

export { CreateUserService };
