import { Request, Response } from "express";
import { resetPasswordService } from "../../services/password/resetPasswordService";

class ResetPasswordController {
  async handle(req: Request, res: Response) {
    const { token, newPassword, model } = req.body;

    try {
      if (!["User", "Professor"].includes(model)) {
        throw new Error("Modelo inválido. Use 'User' ou 'Professor'.");
      }

      await resetPasswordService(token, newPassword, model as "User" | "Professor");
      return res.status(200).json({ message: "Senha redefinida com sucesso." });
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
}

export { ResetPasswordController };
