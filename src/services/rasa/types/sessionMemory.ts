import { RasaSessionData } from "./RasaSessionData";

const sessionMap = new Map<string, RasaSessionData>();

export function getSession(userId: string): RasaSessionData {
  if (!sessionMap.has(userId)) {
    sessionMap.set(userId, {
      nivelAtual: null,
      lastAnswerKeys: [],
      lastSubject: null,
      lastQuestions: [],
    });
  }

  return sessionMap.get(userId)!;
}
