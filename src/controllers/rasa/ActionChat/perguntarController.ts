import { Request, Response } from "express";
import { actionPerguntarService } from "../../../services/rasa/ActionChat/perguntarService";
import { UserAnalysis } from "@/models/UserAnalysis";
import { normalizeSubjectFromMessage } from "../../../utils/normalizeSubject";
import { AppError } from "../../../exceptions/AppError";

export async function actionPerguntarController(req: Request, res: Response) {
  const { message } = req.body;
  const senderId = req.user?.id;
  if (!message || !senderId) {
    throw new AppError("Mensagem ou usuário inválido.", 400);
  }

  // chama o Rasa
  const rasaResp = await actionPerguntarService(message, senderId);

  // incrementa apenas o contador de subject
  const ua = await UserAnalysis.findOne({ userId: senderId });
  if (ua) {
    const subject = normalizeSubjectFromMessage(message) || "unknown";
    ua.addInteraction(subject);
    await ua.save();
  }

  return res.status(200).json(rasaResp);
}
