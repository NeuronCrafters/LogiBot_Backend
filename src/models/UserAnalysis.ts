import { createSqlCompatModel } from "./sqlCompatModel";

export const getEmptySubjectCounts = () => ({
  variaveis: 0,
  listas: 0,
  condicionais: 0,
  operadores_logicos: 0,
  funcoes: 0,
  repeticao: 0,
  verificacoes: 0,
});

export interface IUserAnalysis {
  _id?: string;
  id?: string;
  userId: string;
  name: string;
  email: string;
  schoolId: string;
  schoolName: string;
  courseId: string;
  courseName: string;
  classId: string;
  className: string;
  totalUsageTime: number;
  totalCorrectWrongAnswers?: {
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
  };
  subjectCountsQuiz?: Record<string, number>;
  performanceBySubject?: Map<string, { correct: number; wrong: number }>;
  sessions?: any[];
}

export const UserAnalysis = createSqlCompatModel("UserAnalysis");
