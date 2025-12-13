import { Request, Response } from "express";
import { UpdateNameService } from "../../services/users/UpdateNameService";

class UpdateNameController {
  static handle: any;
  async handle(req: Request, res: Response): Promise<Response> {
    const { userId } = req.params;
    const { name } = req.body;

    const role = req.user?.role;

    if (!role) {
      return res.status(401).json({ error: "Permissão não identificada." });
    }

    const updateNameService = new UpdateNameService();

    try {
      const updatedUser = await updateNameService.execute({
        userId,
        role,
        name,
      });

      return res.status(200).json({
        message: "Nome atualizado com sucesso!",
        user: updatedUser,
      });
    } catch (error: any) {
      return res.status(error.statusCode || 400).json({
        message: error.message || "Erro ao atualizar nome.",
      });
    }
  }
}

export { UpdateNameController };