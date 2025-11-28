
import { Request, Response } from "express";
import { adminDeleteStudentService } from "../../../services/admin/admin/DeleteStudenetService";

export async function deleteStudentController(req: Request, res: Response) {
    try {
        const { studentId } = req.query;

        if (!studentId || typeof studentId !== 'string') {
            return res.status(400).json({
                error: "ID do estudante é obrigatório e deve ser uma string"
            });
        }

        const result = await adminDeleteStudentService(studentId);

        if (!result.success) {
            return res.status(404).json({
                error: result.message
            });
        }

        return res.status(200).json({
            message: "Estudante deletado com sucesso",
            data: result.data
        });

    } catch (error) {

        return res.status(500).json({
            error: "Erro interno do servidor ao deletar estudante"
        });
    }
}