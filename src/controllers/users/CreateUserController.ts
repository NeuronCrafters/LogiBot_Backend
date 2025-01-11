import { Request, Response } from "express";
import { CreateUserService } from "../../services/users/CreateUserService";

class CreateUserController {
  async handle(req: Request, res: Response) {
    try {
      const { name, email, password, role, school } = req.body;

      const createUser = new CreateUserService();
      const user = await createUser.createUser({
        name,
        email,
        password,
        role,
        school,
      });

      return res.status(201).json({
        message: "Usuário criado com sucesso!",
        user,
      });
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro inesperado!",
      });
    }
  }
}


export { CreateUserController }