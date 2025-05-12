import { LogsUniversityUsageService } from "./LogsUniversityUsageService";

export async function LogsUniversityCompareUsageService(universityIds: string[]) {
  try {
    const results = await Promise.all(universityIds.map(id => LogsUniversityUsageService(id)));
    return results;
  } catch (error) {
    throw new Error("Erro na comparação de uso entre universidades");
  }
}
