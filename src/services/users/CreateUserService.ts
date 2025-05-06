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
  disciplineCode: string;
}

class CreateUserService {
  async createUser({ name, email, password, school, disciplineCode }: CreateUserDTO) {
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

    // Buscar a disciplina pelo código
    const discipline = await Discipline.findOne({ code: disciplineCode }).populate("course classes professors");
    if (!discipline) {
      throw new AppError("Código de disciplina inválido!", 404);
    }

    // Verificar se a disciplina tem apenas uma turma associada
    if (!discipline.classes.length) {
      throw new AppError("Disciplina não vinculada a nenhuma turma!", 400);
    }

    if (!discipline.course) {
      throw new AppError("Disciplina sem curso associado!", 400);
    }

    // Selecionar apenas a primeira turma associada
    const classData = await Class.findById(discipline.classes[0]);
    if (!classData) {
      throw new AppError("Turma associada à disciplina não encontrada!", 404);
    }

    // Hash da senha
    const passwordHash = await hash(password, 10);

    // Criar o aluno
    const newStudent = await User.create({
      name,
      email,
      password: passwordHash,
      role: ["student"],
      school,
      course: discipline.course._id,
      class: classData._id,
      disciplines: [discipline._id],
    }) as IUser;

    // Associar o aluno à turma
    if (!classData.students.includes(newStudent._id as Types.ObjectId)) {
      classData.students.push(newStudent._id as Types.ObjectId);
      await classData.save();
    }

    // Associar o aluno à disciplina
    if (!discipline.students.includes(newStudent._id as Types.ObjectId)) {
      discipline.students.push(newStudent._id as Types.ObjectId);
      await discipline.save();
    }

    // Associar o aluno aos professores da disciplina
    if (discipline.professors.length > 0) {
      await Professor.updateMany(
        { _id: { $in: discipline.professors } },
        { $addToSet: { students: newStudent._id } }
      );
    }

    return {
      id: newStudent._id,
      name: newStudent.name,
      email: newStudent.email,
      role: newStudent.role,
      school: university.name,
      course: (discipline.course as any).name,
      class: classData.name,
      disciplines: [discipline.name],
    };
  }
}

export { CreateUserService };
