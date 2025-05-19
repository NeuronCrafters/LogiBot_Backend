import { Request, Response } from "express";
import { conversarService } from "../../../services/rasa/ActionChat/conversarService";

export async function conversarController(req: Request, res: Response) {
  try {
    const data = await conversarService();
    // extrai a resposta de texto (ajuste conforme o shape real do Rasa)
    const text =
      Array.isArray(data.messages) && data.messages[0]?.text
        ? data.messages[0].text
        : // ou se vem em data.text
        (data.text as string) ||
        // fallback
        "Desculpe, não entendi.";

    return res.json({ responses: [{ text }] });
  } catch (error) {
    console.error("Erro no conversarController:", error);
    return res.json({
      responses: [
        {
          text: "Desculpe, ocorreu um problema ao conversar com o bot. Tente novamente mais tarde.",
        },
      ],
    });
  }
}
