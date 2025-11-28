import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { ListStudentsByClassService } from "../../../services/admin/coordinator/ListStudentsByClassService";

export async function ListStudentsByClassForCoordinatorController(
    req: Request,
    res: Response
) {
    const authUser = req.user as { id: string; role: string[] };

    const isAllowed = authUser.role.some(r => ["admin", "course-coordinator", "professor"].includes(r));
    if (!isAllowed) return res.status(403).json({ message: "Acesso negado." });

    const classId = String(req.params.classId || "");
    if (!isValidObjectId(classId)) {
        return res.status(400).json({ message: "classId inválido." });
    }

    const { disciplineId } = req.query;

    try {
        const service = new ListStudentsByClassService();

        const students = await service.execute({
            classId,
            requesterId: authUser.id,
            requesterRole: authUser.role,
            disciplineId: disciplineId as string | undefined
        });

        return res.status(200).json(students);
    } catch (err: any) {
        console.error("Erro ListStudentsByClass:", err);
        return res.status(err.statusCode || 500).json({ message: err.message || "Erro interno." });
    }
}