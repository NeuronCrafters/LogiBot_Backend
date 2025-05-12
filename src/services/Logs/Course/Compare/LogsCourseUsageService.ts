import { LogsCourseUsageService } from "../Individual/LogsCourseUsageService";

export async function LogsCourseUsageCompareService(courseIds: string[]) {
    try {
        const results = await Promise.all(courseIds.map(id => LogsCourseUsageService(id)));
        return results;
    } catch (error) {
        throw new Error("Erro ao comparar tempo de uso entre cursos.");
    }
}