import { Request, Response } from "express";
import { CreateUserService } from "../../services/users/CreateUserService";
import { AppError } from "../../exceptions/AppError";

class CreateUserController {
  async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { name, email, password, code } = req.body;

      if (!name || !email || !password || !code) {
        return res.status(400).json({
          message: "Os campos name, email, password e code são obrigatórios.",
        });
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError("formato de e-mail inválido!", 400);
      }

      if (password.length < 12) {
        throw new AppError("a senha deve ter pelo menos 12 caracteres!", 400);
      }

      const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ0-9\s]{3,}$/;
      if (!nameRegex.test(name.trim())) {
        throw new AppError("nome inválido! deve conter ao menos 3 caracteres e não pode conter símbolos especiais.",
          400
        );
      }

      const createUserService = new CreateUserService();

      const user = await createUserService.createUser({
        name,
        email,
        password,
        code,
      });

      return res.status(201).json({
        message: "Usuário criado com sucesso!",
        user,
      });
    } catch (error: any) {

      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro inesperado!",
      });
    }
  }
}

export { CreateUserController };
