import { Request, Response } from "express";
import { CreateUserService } from "../../services/users/CreateUserService";
import {AppError} from "../../exceptions/AppError";

class CreateUserController {
  async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { name, email, password, code } = req.body;
      if (!name || !email || !password || !code) {
        return res.status(400).json({
          message: "Os campos name, email, password e disciplineCode são obrigatórios.",
        });
      }

      // Validação de formato de e-mail
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new AppError("Formato de e-mail inválido!", 400);
      }

      // Validação de tamanho mínimo da senha
      if (password.length < 12) {
        throw new AppError("A senha deve ter pelo menos 6 caracteres!", 400);
      }

      // Validação de nome (mínimo 3 caracteres e apenas letras/acentos/espaços)
      const nameRegex = /^[A-Za-zÀ-ÖØ-öø-ÿ\s]{3,}$/;
      if (!nameRegex.test(name.trim())) {
        throw new AppError("Nome inválido! Deve conter ao menos 3 letras e não conter números ou símbolos.", 400);
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
      console.error("Erro ao criar usuário:", error.message);
      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro inesperado!",
      });
    }
  }
}

export { CreateUserController };