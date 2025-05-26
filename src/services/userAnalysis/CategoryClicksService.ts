import { UserAnalysis } from "../../models/UserAnalysis";

export async function updateCategoryClicksService(
    userId: string,
    clicks: Record<string, number>
): Promise<void> {
    const ua = await UserAnalysis.findOne({ userId });
    if (!ua) {
        throw new Error(`UserAnalysis não encontrado para userId=${userId}`);
    }

    // Para cada categoria, invoca o método de instância
    for (const [rawSubject, count] of Object.entries(clicks)) {
        for (let i = 0; i < count; i++) {
            ua.updateSubjectCountsQuiz(rawSubject);
        }
    }

    // Salva as alterações
    await ua.save();
}
