import { Request, Response } from "express";
import { updateCategoryClicksService } from "../../services/userAnalysis/CategoryClicksService";

interface BatchClicksBody {
    userId: string;
    clicks: Record<string, number>;
}

export async function categoryClicksController(req: Request, res: Response) {
    try {
        const { userId, clicks } = req.body as BatchClicksBody;

        if (!userId || typeof clicks !== "object") {
            return res.status(400).json({ message: "Payload inválido." });
        }

        await updateCategoryClicksService(userId, clicks);
        return res.status(200).json({ message: "Cliques contabilizados com sucesso." });
    } catch (err: any) {
        console.error("[categoryClicksController] Erro:", err);
        return res.status(500).json({ message: "Erro ao processar cliques de categoria.", detail: err.message });
    }
}
