import { Request, Response } from "express";
import { isValidObjectId } from "mongoose";
import { ListStudentsByClassForCoordinatorService } from "../../../services/admin/coordinator/ListStudentsByClassForCoordinatorService";
import { Professor } from "../../../models/Professor";

export async function ListStudentsByClassForCoordinatorController(
    req: Request,
    res: Response
) {
    const authUser = req.user as { id: string; role: string[]; school?: string };
    const isAdmin = authUser.role.includes("admin");
    const isCoordinator = authUser.role.includes("course-coordinator");
    if (!isAdmin && !isCoordinator) {
        return res.status(403).json({ message: "Acesso negado." });
    }

    // valida classId
    const classId = String(req.params.classId || "");
    if (!isValidObjectId(classId)) {
        return res.status(400).json({ message: "classId inválido ou ausente." });
    }

    // resolve courseId
    let courseId: string;
    if (isCoordinator) {
        const prof = await Professor.findById(authUser.id).select("courses").lean();
        if (!prof?.courses?.length) {
            return res
                .status(400)
                .json({ message: "Coordenador sem curso associado." });
        }
        courseId = String(prof.courses[0]);
    } else {
        const raw = req.query.courseId;
        if (!raw) {
            return res
                .status(400)
                .json({ message: "Parâmetro courseId é obrigatório para admin." });
        }
        courseId = Array.isArray(raw) ? String(raw[0]) : String(raw);
        if (!isValidObjectId(courseId)) {
            return res.status(400).json({ message: "courseId inválido." });
        }
    }

    try {
        const students = await ListStudentsByClassForCoordinatorService(
            // para admin passa undefined, para coord passa authUser.school
            isCoordinator ? authUser.school! : undefined,
            courseId,
            classId
        );
        return res.status(200).json(students);
    } catch (err) {
        console.error("Erro ao listar alunos por turma:", err);
        return res
            .status(500)
            .json({ message: "Erro interno ao listar alunos por turma." });
    }
}
