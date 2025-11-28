import { Request, Response } from "express";
import { conversarService } from "../../../services/rasa/ActionChat/conversarService";

export async function conversarController(req: Request, res: Response) {
  try {
    const data = await conversarService();
    const text =
      Array.isArray(data.messages) && data.messages[0]?.text
        ? data.messages[0].text
        :
        (data.text as string) ||
        "Desculpe, não entendi.";

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
