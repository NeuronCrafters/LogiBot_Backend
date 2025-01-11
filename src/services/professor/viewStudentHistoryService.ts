import { History } from "../../models/History";

class ViewStudentHistoryService {
  async execute(studentId: string): Promise<any[]> {
    try {
      const historyRecords = await History.find({ student: studentId });

      if (!historyRecords || historyRecords.length === 0) {
        throw new Error("Histórico não encontrado.");
      }

      return historyRecords.map((history: any) => ({
        content: history.content,
        date: history.date,
      }));
    } catch (error) {
      throw new Error("Erro ao buscar histórico do aluno.");
    }
  }
}

export { ViewStudentHistoryService };
