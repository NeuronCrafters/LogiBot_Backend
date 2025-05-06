import { Request, Response } from "express";
import { CreateUserService } from "../../services/users/CreateUserService";

class CreateUserController {
  async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { name, email, password, school, disciplineCode } = req.body;

      if (!name || !email || !password || !school || !disciplineCode) {
        return res.status(400).json({
          message: "Os campos name, email, password, school e disciplineCode são obrigatórios.",
        });
      }

      const createUserService = new CreateUserService();

      const user = await createUserService.createUser({
        name,
        email,
        password,
        school,
        disciplineCode,
      });

      return res.status(201).json({
        message: "Usuário criado com sucesso!",
        user,
      });
    } catch (error: any) {
      console.error("Erro ao criar usuário:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro inesperado!",
      });
    }
  }
}

export { CreateUserController };
