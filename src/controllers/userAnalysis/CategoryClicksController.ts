import { Request, Response } from "express";
import { updateCategoryClicksService } from "@/services/userAnalysis/CategoryClicksService";
import { normalizeSubjectFromMessage } from "@/utils/normalizeSubject";

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

        const normalized: Record<string, number> = {
            variaveis: 0,
            tipos: 0,
            funcoes: 0,
            loops: 0,
            verificacoes: 0,
        };

        for (const [raw, count] of Object.entries(clicks)) {
            let cat = normalizeSubjectFromMessage(raw)
                || "tipos";

            normalized[cat] = (normalized[cat] || 0) + count;
        }

        await updateCategoryClicksService(userId, normalized);

        return res
            .status(200)
            .json({ message: "Cliques de categoria contabilizados com sucesso." });
    } catch (err: any) {
        console.error("[categoryclickscontroller] erro:", err);
        return res
            .status(500)
            .json({
                message: "Erro ao processar cliques de categoria.",
                detail: err.message,
            });
    }
}
