import { RasaSessionData } from "../types/RasaSessionData";

export function getGabaritoService(session: RasaSessionData) {
  return {
    answer_keys: session.lastAnswerKeys,
    assunto: session.lastSubject,
  };
}
