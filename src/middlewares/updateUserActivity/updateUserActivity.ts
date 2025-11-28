import { Request, Response, NextFunction } from "express";
import { UserAnalysis } from "../../models/UserAnalysis";

export async function updateUserActivity(req: Request, res: Response, next: NextFunction) {
    const userId = req.user?.id;

    if (userId) {
        try {
            await UserAnalysis.updateOne(
                {
                    userId: userId,
                    "sessions.sessionEnd": null
                },
                {
                    $set: { "sessions.$.lastActivityAt": new Date() }
                }
            );
        } catch (error) {
            console.error("falha ao atualizar a atividade do usuário:", error);
        }
    }

    next();
}