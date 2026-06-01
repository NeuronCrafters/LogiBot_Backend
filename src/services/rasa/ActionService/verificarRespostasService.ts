import { AppError } from "../../../exceptions/AppError";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { RasaSessionData } from "../types/RasaSessionData";

interface QuizResultData {
  message: string;
  totalCorrectAnswers: number;
  totalWrongAnswers: number;
  feedback?: string[];
  detalhes: Array<{
    question: string;
    selected: string;
    correct: string;
    isCorrect: boolean;
    explanation?: string;
  }>;
  subject: string;
  nivel: string;
}

export async function verificarRespostasService(
  respostas: string[],
  userId: string,
  email: string,
  session: RasaSessionData,
  role: string | string[]
): Promise<QuizResultData & { source: "local" }> {
  if (!session.lastAnswerKeys?.length || !session.lastQuestions?.length) {
    throw new AppError("sessao invalida: perguntas ou gabarito ausentes.", 400);
  }

  if (respostas.length !== session.lastAnswerKeys.length) {
    throw new AppError("numero de respostas nao corresponde ao numero de perguntas.", 400);
  }

  const detalhes = session.lastAnswerKeys.map((correctAnswer, index) => {
    const selected = (respostas[index] || "").trim().toUpperCase();
    const correct = (correctAnswer || "").trim().toUpperCase();
    const question = session.lastFullQuestions?.[index];

    return {
      question: session.lastQuestions[index] || question?.question || "Pergunta nao encontrada",
      selected,
      correct,
      isCorrect: selected === correct,
      explanation: question?.explanation?.[selected] || "",
    };
  });

  const totalCorrectAnswers = detalhes.filter((detail) => detail.isCorrect).length;
  const totalWrongAnswers = detalhes.length - totalCorrectAnswers;

  const result: QuizResultData = {
    message: `Voce acertou ${totalCorrectAnswers} de ${detalhes.length}.`,
    totalCorrectAnswers,
    totalWrongAnswers,
    detalhes,
    subject: session.lastSubject || "",
    nivel: session.nivelAtual || "",
  };

  const isStudent = Array.isArray(role)
    ? role.includes("student")
    : role === "student";

  if (isStudent) {
    const ua = await UserAnalysis.findOne({ userId, email }).exec();
    if (!ua) throw new AppError("usuario nao encontrado.", 404);

    if (!ua.sessions.length || ua.sessions[ua.sessions.length - 1].sessionEnd) {
      ua.sessions.push({
        sessionStart: new Date(),
        totalCorrectAnswers: 0,
        totalWrongAnswers: 0,
        answerHistory: [],
      } as any);
    }

    const sessionIndex = ua.sessions.length - 1;

    ua.sessions[sessionIndex].answerHistory.push({
      questions: result.detalhes.map((detail) => ({
        level: session.nivelAtual || "Nivel",
        subject: session.lastSubject || "assunto",
        selectedOption: {
          question: detail.question,
          isCorrect: detail.isCorrect,
          isSelected: detail.selected,
        },
        explanation: detail.explanation,
        totalCorrectAnswers: detail.isCorrect ? 1 : 0,
        totalWrongAnswers: detail.isCorrect ? 0 : 1,
        timestamp: new Date(),
      })),
      totalCorrectWrongAnswersSession: {
        totalCorrectAnswers: result.totalCorrectAnswers,
        totalWrongAnswers: result.totalWrongAnswers,
      },
    });

    ua.sessions[sessionIndex].totalCorrectAnswers += result.totalCorrectAnswers;
    ua.sessions[sessionIndex].totalWrongAnswers += result.totalWrongAnswers;
    ua.totalCorrectWrongAnswers.totalCorrectAnswers += result.totalCorrectAnswers;
    ua.totalCorrectWrongAnswers.totalWrongAnswers += result.totalWrongAnswers;

    ua.markModified(`sessions.${sessionIndex}`);
    await ua.save();
  }

  return {
    ...result,
    source: "local",
  };
}
