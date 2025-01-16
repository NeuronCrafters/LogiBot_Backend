import { History, IHistory } from "../../models/History";

class RasaGetHistoryService {
  async execute(studentId?: string): Promise<IHistory[]> {
    const filter = studentId ? { student: studentId } : {};
    return History.find(filter).populate("student").exec();
  }
}

export { RasaGetHistoryService };
