import { LogsCourseAccuracyService } from "../Individual/LogsCourseAccuracyService";

export async function LogsCourseAccuracyCompareService(courseIds: string[]) {
    try {
        const results = await Promise.all(courseIds.map(id => LogsCourseAccuracyService(id)));
        return results;
    } catch (error) {
        throw new Error("Erro ao comparar acurácia entre cursos.");
    }
}