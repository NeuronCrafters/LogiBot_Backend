import { hash } from "bcryptjs";
import { AppError } from "../../exceptions/AppError";
import { User, IUser } from "../../models/User";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { University } from "../../models/University";
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
    try {
      // Verificar se o email já está em uso
      const userExists = await User.findOne({ email });
      if (userExists) {
        throw new AppError("Email já está em uso por outro usuário!", 409);
      }

      if (!email || !password) {
        throw new AppError("Email e senha são obrigatórios!", 400);
      }

      // Verificar se a universidade existe
      const university = await University.findById(school);
      if (!university) {
        throw new AppError("Universidade não encontrada!", 404);
      }

      // Verificar se o curso existe na universidade
      const courseData = await Course.findOne({
        name: course,
        university: school,
      });
      if (!courseData) {
        throw new AppError("Curso não encontrado na universidade especificada.", 404);
      }

      // Verificar se a turma existe para o curso
      const classData = await Class.findOne({
        name: className,
        course: courseData._id,
      });
      if (!classData) {
        throw new AppError("Turma não encontrada para o curso especificado.", 404);
      }

      // Criando o aluno
      const passwordHash = await hash(password, 10);
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

      return {
        id: newStudent._id,
        name: newStudent.name,
        email: newStudent.email,
        role: newStudent.role,
        school: university.name,
        course: courseData.name,
        class: classData.name,
      };
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      throw new AppError(error.message || "Erro ao criar usuário.", 500);
    }
  }
}

export { CreateUserService };
