import { AppError } from "../../../exceptions/AppError";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { RasaSessionData } from "../types/RasaSessionData";

export async function verificarRespostasService(
  respostas: string[],
  userId: string,
  email: string,
  session: RasaSessionData
) {
  if (!session.lastAnswerKeys.length || !session.lastQuestions.length) {
    throw new AppError("Gabarito ou perguntas não definidos.", 400);
  }

  const normalizeOption = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, "");

  let acertos = 0;
  let erros = 0;

  const answerHistoryEntry = respostas.map((resposta, index) => {
    const respostaNormalizada = normalizeOption(resposta);
    const gabaritoNormalizado = normalizeOption(session.lastAnswerKeys[index]);

    const isCorrect = respostaNormalizada === gabaritoNormalizado;

    if (isCorrect) acertos++;
    else erros++;

    return {
      level: session.nivelAtual || "Nível desconhecido",
      subject: session.lastSubject || "Assunto desconhecido",
      selectedOption: {
        question: session.lastQuestions[index] || "N/A",
        isCorrect: String(isCorrect),
        isSelected: resposta || "false",
      },
      totalCorrectAnswers: isCorrect ? 1 : 0,
      totalWrongAnswers: isCorrect ? 0 : 1,
      timestamp: new Date(),
    };
  });

  const userAnalysis = await UserAnalysis.findOne({ userId, email });
  if (!userAnalysis || !userAnalysis.sessions?.length) {
    throw new AppError("Usuário ou sessão não encontrada.", 404);
  }

  const lastSessionIndex = userAnalysis.sessions.length - 1;
  userAnalysis.sessions[lastSessionIndex].answerHistory.push({ questions: answerHistoryEntry });

  userAnalysis.totalCorrectAnswers = (userAnalysis.totalCorrectAnswers || 0) + acertos;
  userAnalysis.totalWrongAnswers = (userAnalysis.totalWrongAnswers || 0) + erros;

  userAnalysis.sessions[lastSessionIndex].totalCorrectAnswers =
    (userAnalysis.sessions[lastSessionIndex].totalCorrectAnswers || 0) + acertos;
  userAnalysis.sessions[lastSessionIndex].totalWrongAnswers =
    (userAnalysis.sessions[lastSessionIndex].totalWrongAnswers || 0) + erros;

  try {
    await userAnalysis.save();
  } catch (error) {
    console.error("Erro ao salvar o histórico de respostas:", error);
    throw new AppError("Erro ao salvar as respostas: " + error.message, 500);
  }

  return {
    message: acertos === respostas.length ? "🎉 Parabéns! Acertou todas!" : "⚠️ Confira seu resultado:",
    totalCorrectAnswers: acertos,
    totalWrongAnswers: erros,
    detalhes: { questions: answerHistoryEntry },
  };
}
