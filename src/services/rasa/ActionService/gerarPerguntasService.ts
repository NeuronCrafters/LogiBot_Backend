import { AppError } from "../../../exceptions/AppError";
import { RasaSessionData } from "../types/RasaSessionData";
import { cleanQuestionOptions, findLocalQuiz } from "./localSaelData";

export async function gerarPerguntasService(
  pergunta: string,
  session: RasaSessionData
) {
  if (!session.nivelAtual) {
    throw new AppError("o nivel do usuario precisa ser definido antes de gerar perguntas.", 400);
  }

  const quiz = findLocalQuiz(pergunta, session.nivelAtual);
  const cleanedQuestions = cleanQuestionOptions(quiz.questions);

  session.lastSubject = pergunta;
  session.lastQuestions = cleanedQuestions.map((question) => question.question);
  session.lastFullQuestions = cleanedQuestions;
  session.lastAnswerKeys = quiz.answer_keys;

  return {
    perguntas: cleanedQuestions,
    gabarito: quiz.answer_keys,
    nivel: session.nivelAtual,
    assunto: pergunta,
    metadata: {
      subject: pergunta,
      level: session.nivelAtual,
      generated_at: new Date().toISOString(),
    },
  };
}
