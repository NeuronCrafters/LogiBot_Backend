import { Request, Response } from "express";
import { conversarService } from "../../../services/rasa/ActionChat/conversarService";

export async function conversarController(req: Request, res: Response) {
  try {
    const data = await conversarService();
    const legacyData = data as any;
    const text =
      data.responses?.[0]?.text ||
      legacyData.messages?.[0]?.text ||
      legacyData.text ||
      "Desculpe, nao entendi.";

    return res.json({ responses: [{ text }] });
  } catch (error) {
    return res.json({
      responses: [
        {
          text: "Desculpe, ocorreu um problema ao conversar com o bot. Tente novamente mais tarde.",
        },
      ],
    });
  }
}
