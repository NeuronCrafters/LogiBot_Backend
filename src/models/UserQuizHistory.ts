import { createSqlCompatModel } from "./sqlCompatModel";

export interface IUserQuizHistory {
  _id?: string;
  id?: string;
  userId: string;
  subjectCounts?: Record<string, number>;
  sessions?: any[];
  addQuizAttempt?: (quizId: string, questionsData: any[], customTitle?: string) => Promise<void>;
}

export const UserQuizHistory = createSqlCompatModel("UserQuizHistory");
