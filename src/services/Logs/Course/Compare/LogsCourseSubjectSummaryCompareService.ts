import { LogsCourseSubjectSummaryService } from "../Individual/LogsCourseSubjectSummaryService";

export async function LogsCourseSubjectSummaryCompareService(courseIds: string[]) {
    try {
        const results = await Promise.all(courseIds.map(id => LogsCourseSubjectSummaryService(id)));
        return results;
    } catch (error) {
        throw new Error("Erro ao comparar resumo de assuntos entre cursos.");
    }
}
