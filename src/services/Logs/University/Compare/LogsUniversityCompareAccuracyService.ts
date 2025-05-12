import { LogsUniversityAccuracyService } from "./LogsUniversityAccuracyService";

export async function LogsUniversityCompareAccuracyService(universityIds: string[]) {
  try {
    const results = await Promise.all(universityIds.map(id => LogsUniversityAccuracyService(id)));
    return results;
  } catch (error) {
    throw new Error("Erro na comparação de acertos e erros entre universidades");
  }
}
