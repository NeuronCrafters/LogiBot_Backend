import { History, IHistory } from "../../models/History";

interface SaveHistoryRequest {
  studentId: string;
  messages: { sender: string; text: string }[];
  metadata?: Record<string, any>;
  startTime: Date;
  endTime: Date;
}

class RasaSaveHistoryService {
  async execute(data: SaveHistoryRequest): Promise<IHistory> {
    const history = await History.create({
      student: data.studentId,
      messages: data.messages,
      metadata: data.metadata,
      startTime: data.startTime,
      endTime: data.endTime,
    });

    return history;
  }
}

export { RasaSaveHistoryService };
