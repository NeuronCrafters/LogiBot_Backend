import { hash } from "bcryptjs";
import { AppError } from "../../exceptions/AppError";
import { User, IUser } from "../../models/User";
import { Professor } from "../../models/Professor";
import { Course } from "../../models/Course";
import { Class } from "../../models/Class";
import { Disciple } from "../../models/Discipline";
import { Types } from "mongoose";

interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role?: string;
  school: string; // Universidade
  course: string; // Curso
  class: string; // Turma
  subjects: { code: string; name: string }[]; // Disciplinas
}

class CreateUserService {
  async createUser({ name, email, password, role = "student", school, course, class: className, subjects }: CreateUserDTO) {
    try {
      // Verifica se o email já está em uso por outro usuário
      const userExists = await User.findOne({ email });
      const professorExists = await Professor.findOne({ email });

      if (userExists || professorExists) {
        throw new AppError("Email já está em uso por outro usuário!", 409);
      }

      // Verifica se os campos obrigatórios foram preenchidos
      if (!email || !password) {
        throw new AppError("Email e senha são obrigatórios!", 400);
      }

      const passwordHash = await hash(password, 10);

      // Verifica se o curso existe na universidade
      const courseData = await Course.findOne({ name: course, university: school });
      if (!courseData) {
        throw new AppError("Curso não encontrado na universidade especificada.", 404);
      }

      // Verifica se há um professor associado ao curso e à universidade
      const professor = await Professor.findOne({ school, courses: courseData._id });
      if (!professor) {
        throw new AppError("Nenhum professor encontrado para o curso na universidade especificada.", 404);
      }

      // Verifica se a turma existe para o curso
      const classData = await Class.findOne({ name: className, course: courseData._id });
      if (!classData) {
        throw new AppError("Turma não encontrada para o curso especificado.", 404);
      }

      // Verifica e/ou cria disciplinas
      const subjectIds: Types.ObjectId[] = await Promise.all(
        subjects.map(async ({ code, name }) => {
          const existingSubject = await Subject.findOne({ code, name });
          if (existingSubject) {
            // Adiciona a turma à disciplina se já existir
            if (!existingSubject.classes.includes(classData._id)) {
              existingSubject.classes.push(classData._id);
              await existingSubject.save();
            }
            return existingSubject._id;
          }

          // Cria a disciplina e associa à turma
          const newSubject = await Subject.create({
            code,
            name,
            classes: [classData._id],
          });
          return newSubject._id;
        })
      );

      // Cria o aluno
      const newStudent = await User.create({
        name,
        email,
        password: passwordHash,
        role: "student",
        school,
        course: courseData._id,
        class: classData._id,
      }) as IUser;

      // Adiciona o aluno à turma
      if (!classData.students.includes(newStudent._id)) {
        classData.students.push(newStudent._id);
        await classData.save();
      }

      // Adiciona o aluno às disciplinas
      for (const subjectId of subjectIds) {
        const subject = await Subject.findById(subjectId);
        if (subject && !subject.classes.includes(classData._id)) {
          subject.classes.push(classData._id);
          await subject.save();
        }
      }

      // Retorna os dados do novo aluno
      return {
        id: newStudent._id,
        name: newStudent.name,
        email: newStudent.email,
        role: newStudent.role,
        school: newStudent.school,
        course: courseData.name,
        class: classData.name,
        subjects: subjects.map(({ code, name }) => ({ code, name })),
        professor: {
          id: professor._id,
          name: professor.name,
        },
      };
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      throw new AppError(error.message || "Erro ao criar usuário.", 500);
    }
  }
}

export { CreateUserService };
