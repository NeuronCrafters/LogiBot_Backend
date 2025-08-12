import { Request, Response } from "express";
import { UpdateUserStatusService } from "../../../services/admin/admin/UpdateUserStatusService";
import { AppError } from "../../../exceptions/AppError";

export class UpdateUserStatusController {
  public async handle(req: Request, res: Response): Promise<Response> {
    const { userId } = req.params;
    const { status } = req.body;

    const updateUserStatusService = new UpdateUserStatusService();

    try {
      const updatedUser = await updateUserStatusService.execute(userId, status);
      return res.status(200).json(updatedUser);
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      console.error("Erro inesperado no UpdateUserStatusController:", error);
      return res.status(500).json({ message: "Erro interno do servidor." });
    }
  }
}