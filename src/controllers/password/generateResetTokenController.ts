import { Request, Response } from "express";
import { generateResetToken } from "../../services/password/generateResetTokenService";

class GenerateResetTokenController {
  async handle(req: Request, res: Response) {
    const { email, model } = req.body;

    try {
      if (!["User", "Professor"].includes(model)) {
        throw new Error("Modelo inválido. Use 'User' ou 'Professor'.");
      }
      const { token, resetLink } = await generateResetToken(email, model as "User" | "Professor");

      return res.status(200).json({
        message: "Token gerado com sucesso.",
        token,
        resetLink,
      });
    } catch (error) {

      return res.status(400).json({ error: error.message });

    }
  }
}

export { GenerateResetTokenController };
