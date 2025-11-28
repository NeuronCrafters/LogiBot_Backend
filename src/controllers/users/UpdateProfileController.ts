import { Request, Response } from "express";
import { UpdateProfileService } from "../../services/users/UpdateProfileService";

class UpdateProfileController {
  async handle(req: Request, res: Response): Promise<Response> {
    try {
      const { userId } = req.params;
      const { name, email, password } = req.body;

      if (!userId) {
        return res.status(400).json({
          message: "O ID do usuário é obrigatório.",
        });
      }

      const updateProfileService = new UpdateProfileService();
      const updatedUser = await updateProfileService.updateProfile({
        userId,
        name,
        email,
        password,
      });

      return res.status(200).json({
        message: "Perfil atualizado com sucesso!",
        user: updatedUser,
      });
    } catch (error: any) {

      return res.status(error.statusCode || 500).json({
        message: error.message || "Erro inesperado!",
      });
    }
  }
}

export { UpdateProfileController };