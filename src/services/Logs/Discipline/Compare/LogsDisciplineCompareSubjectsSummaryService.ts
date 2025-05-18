import { UserAnalysis } from "../../../../models/UserAnalysis";
import { User } from "../../../../models/User";
import { Discipline } from "../../../../models/Discipline";
import { AppError } from "../../../../exceptions/AppError";

export async function LogsDisciplineCompareSubjectsSummaryService(disciplineIds: string[]) {
    try {
        if (!Array.isArray(disciplineIds) || disciplineIds.length === 0) {
            throw new AppError("Lista de IDs de disciplinas inválida", 400);
        }

        // Buscar nomes das disciplinas
        const disciplines = await Discipline.find({ _id: { $in: disciplineIds } }).select("_id name");

        // Buscar alunos de cada disciplina
        const students = await User.find({ disciplines: { $in: disciplineIds } }).select("_id disciplines");

        if (!students.length) {
            throw new AppError("Nenhum aluno encontrado nas disciplinas informadas", 404);
        }

        const userIds = students.map(s => s._id);
        const analyses = await UserAnalysis.find({ userId: { $in: userIds } });

        const results = [];

        for (const discipline of disciplines) {
            const disciplineId = discipline._id.toString();
            const disciplineName = discipline.name;

            // Alunos desta disciplina específica
            const disciplineStudents = students.filter(s =>
                s.disciplines.some((d: any) => d.toString() === disciplineId)
            );

            const studentIds = disciplineStudents.map(s => s._id.toString());
            const disciplineAnalyses = analyses.filter(a => studentIds.includes(a.userId));

            // Acumular frequência de assuntos
            const subjectFrequency: Record<string, number> = {};

            for (const analysis of disciplineAnalyses) {
                for (const [subject, count] of Object.entries(analysis.subjectFrequencyGlobal || {})) {
                    subjectFrequency[subject] = (subjectFrequency[subject] || 0) + Number(count);
                }
            }

            // Ordenar assuntos por frequência
            const rankedSubjects = Object.entries(subjectFrequency)
                .sort((a, b) => b[1] - a[1])
                .map(([subject, count]) => ({ subject, count }));

            const mostAccessed = rankedSubjects.length > 0 ? rankedSubjects[0] : { subject: null, count: 0 };

            results.push({
                disciplineId,
                disciplineName,
                subjectFrequency,
                rankedSubjects,
                mostAccessed,
                studentCount: disciplineStudents.length
            });
        }

        return results;
    } catch (error) {
        if (error instanceof AppError) throw error;
        throw new AppError("Erro ao comparar assuntos por disciplina", 500);
    }
}