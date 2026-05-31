import type { QuizQuestion } from "./quiz";

interface RuntimeSession {
  nivelAtual: string | null;
  lastAnswerKeys: string[];
  lastSubject: string | null;
  lastQuestions: string[];
  lastFullQuestions: QuizQuestion[];
}

const sessions = new Map<string, RuntimeSession>();

export function getRuntimeSession(userId: string): RuntimeSession {
  const current = sessions.get(userId);
  if (current) return current;

  const created: RuntimeSession = {
    nivelAtual: null,
    lastAnswerKeys: [],
    lastSubject: null,
    lastQuestions: [],
    lastFullQuestions: [],
  };

  sessions.set(userId, created);
  return created;
}
