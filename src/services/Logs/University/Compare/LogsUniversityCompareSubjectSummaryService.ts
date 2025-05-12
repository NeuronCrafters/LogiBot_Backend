import { LogsUniversitySubjectSummaryService } from "services/Logs/University/Individual/LogsUniversitySubjectSummaryService";

export async function LogsUniversityCompareSubjectSummaryService(universityIds: string[]) {
  try {
    const results = await Promise.all(universityIds.map(id => LogsUniversitySubjectSummaryService(id)));
    return results;
  } catch (error) {
    throw new Error("Erro na comparação de assuntos entre universidades");
  }
}
