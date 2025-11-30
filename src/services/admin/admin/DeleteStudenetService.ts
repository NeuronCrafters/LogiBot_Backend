import { User } from "../../../models/User";
import mongoose from "mongoose";

interface DeleteStudentResult {
    success: boolean;
    message: string;
    data?: any;
}

export async function adminDeleteStudentService(studentId: string): Promise<DeleteStudentResult> {
    try {
        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return {
                success: false,
                message: "ID do estudante inválido"
            };
        }

        const student = await User.findById(studentId);

        if (!student) {
            return {
                success: false,
                message: "Estudante não encontrado"
            };
        }

        if (!student.role.includes("student")) {
            return {
                success: false,
                message: "Usuário não é um estudante"
            };
        }

        const deletedStudent = await User.findByIdAndDelete(studentId);

        if (!deletedStudent) {
            return {
                success: false,
                message: "Erro ao deletar estudante"
            };
        }

        return {
            success: true,
            message: "Estudante deletado com sucesso",
            data: {
                id: deletedStudent._id,
                name: deletedStudent.name,
                email: deletedStudent.email
            }
        };

    } catch (error) {

        return {
            success: false,
            message: "Erro interno ao deletar estudante"
        };
    }
}