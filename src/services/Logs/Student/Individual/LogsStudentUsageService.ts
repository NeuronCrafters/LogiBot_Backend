import { UserAnalysis } from "../../../../models/UserAnalysis";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsStudentUsageService(studentId: string) {
    try {
        const analysis = await UserAnalysis.findOne({ userId: studentId });
        if (!analysis) {
            throw new AppError("Análise do estudante não encontrada", 404);
        }

        // Adicionar detalhes sobre sessões para uma análise mais detalhada
        const sessionDetails = analysis.sessions.map(session => ({
            sessionStart: session.sessionStart,
            sessionEnd: session.sessionEnd,
            sessionDuration: session.sessionDuration || 0
        }));

        return {
            totalUsageTime: analysis.totalUsageTime || 0,
            sessionCount: analysis.sessions.length,
            sessionDetails
        };
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao buscar tempo de uso do estudante", 500);
    }
}