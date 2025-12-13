import { Request, Response } from "express";
import { UpdateEmailService } from "../../services/users/UpdateEmailService";

class UpdateEmailController {
  async handle(req: Request, res: Response): Promise<Response> {
    const { userId } = req.params;
    const { email } = req.body;

    const role = req.user?.role;

    if (!role) {
      return res.status(401).json({ error: "Permissão não identificada." });
    }

    const updateEmailService = new UpdateEmailService();

    try {
      const updatedUser = await updateEmailService.execute({
        userId,
        role,
        email,
      });

      return res.status(200).json({
        message: "E-mail atualizado com sucesso!",
        user: updatedUser,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 400).json({
        message: error.message || "Erro ao atualizar e-mail.",
      });
    }
  }
}

export { UpdateEmailController };