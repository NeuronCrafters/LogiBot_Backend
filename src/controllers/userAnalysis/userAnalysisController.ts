import { Request, Response } from "express";
import { recordInteraction } from "services/userAnalysis/userAnalysisService";

export async function addInteraction(req: Request, res: Response) {
    const { message } = req.body;
    const userId = (req as any).user?.id as string;
    if (!userId) {
        return res.status(401).json({ error: "Usuário não autenticado" });
    }
    if (typeof message !== "string" || !message.trim()) {
        return res.status(400).json({ error: "Campo 'message' é obrigatório" });
    }

    try {
        await recordInteraction(userId, message.trim());
        return res.status(200).json({ success: true });
    } catch (err: any) {
        console.error("Erro em recordInteraction:", err);
        return res.status(500).json({ error: err.message || "Erro interno" });
    }
}
