import { hash } from "bcryptjs";
import { AppError } from "../../exceptions/AppError";
import { User, IUser } from "../../models/User";
import { Professor } from "../../models/Professor";
import { Types } from "mongoose";

interface CreateUserDTO {
  name: string;
  email: string;
  password: string;
  role?: string;
  school: string;
}

class CreateUserService {
  async createUser({ name, email, password, role, school }: CreateUserDTO) {
    try {
      const userExists = await User.findOne({ email });
      const professorExists = await Professor.findOne({ email });

      if (userExists || professorExists) {
        throw new AppError("Email já está em uso por outro usuário!", 409);
      }

      if (!email || !password) {
        throw new AppError("Email e senha são obrigatórios!", 400);
      }

      const passwordHash = await hash(password, 10);

      if (role === "professor") {
        const newProfessor = await Professor.create({
          name,
          email,
          password: passwordHash,
          role: "professor",
          school,
        });

        return {
          id: newProfessor._id,
          name: newProfessor.name,
          email: newProfessor.email,
          role: newProfessor.role,
          school: newProfessor.school,
        };
      }

      const professor = await Professor.findOne({ school });
      if (!professor) {
        throw new AppError("Nenhum professor encontrado para esta escola.", 404);
      }

      const newUser = await User.create({
        name,
        email,
        password: passwordHash,
        role: role || "student",
        school,
      }) as IUser;

      professor.students.push(new Types.ObjectId(newUser._id));


      return {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        school: newUser.school,
        professor: {
          id: professor._id,
          name: professor.name,
        },
      };
    } catch (error) {
      console.error("Erro ao criar aluno:", error);
      throw new AppError("Erro ao criar aluno.", 400);
    }
  }
}

export { CreateUserService };
