import { AppError } from "../../../exceptions/AppError";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { RasaSessionData } from "../types/RasaSessionData";

export async function verificarRespostasService(
  respostas: string[],
  userId: string,
  email: string,
  session: RasaSessionData,
  role: string[] | string
) {
  if (
    !session.lastAnswerKeys ||
    !session.lastQuestions ||
    session.lastAnswerKeys.length === 0 ||
    session.lastQuestions.length === 0
  ) {
    throw new AppError("Gabarito ou perguntas não definidos.", 400);
  }

  if (respostas.length !== session.lastAnswerKeys.length) {
    throw new AppError("Número de respostas não corresponde ao número de perguntas.", 400);
  }

  const normalizeOption = (value: string) =>
    value
      .replace(/options\s*/i, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");

  let acertos = 0;
  let erros = 0;

  // Se não for aluno, calcula e retorna o resultado sem salvar no banco
  if (role !== "student") {
    const detalhes = session.lastQuestions.map((question, index) => {
      const resposta = respostas[index];
      const gabarito = session.lastAnswerKeys[index];
      const isCorrect = normalizeOption(resposta) === normalizeOption(gabarito);

      if (isCorrect) acertos++;
      else erros++;

      return {
        level: session.nivelAtual || "Nível desconhecido",
        subject: session.lastSubject || "Assunto desconhecido",
        selectedOption: {
          question: question || "Pergunta desconhecida",
          isCorrect: isCorrect ? "true" : "false",
          isSelected: resposta || "false",
        },
        totalCorrectAnswers: isCorrect ? 1 : 0,
        totalWrongAnswers: isCorrect ? 0 : 1,
        timestamp: new Date(),
      };
    });

    return {
      message:
        acertos === respostas.length
          ? "🎉 Parabéns! Acertou todas!"
          : "⚠️ Confira seu resultado:",
      totalCorrectAnswers: acertos,
      totalWrongAnswers: erros,
      detalhes: {
        questions: detalhes,
      },
    };
  }

  // Fluxo completo para estudantes
  const userAnalysis = await UserAnalysis.findOne({ userId, email });
  if (!userAnalysis || !userAnalysis.sessions?.length) {
    throw new AppError("Usuário ou sessão não encontrada.", 404);
  }

  const lastSessionIndex = userAnalysis.sessions.length - 1;
  const lastSession = userAnalysis.sessions[lastSessionIndex];

  for (let index = 0; index < respostas.length; index++) {
    const resposta = respostas[index];
    const gabarito = session.lastAnswerKeys[index];
    const pergunta = session.lastQuestions[index];

    const respostaNormalizada = normalizeOption(resposta);
    const gabaritoNormalizado = normalizeOption(gabarito);

    const isCorrect = respostaNormalizada === gabaritoNormalizado;
    const isCorrectStr = isCorrect ? "true" : "false";

    if (isCorrect) acertos++;
    else erros++;

    userAnalysis.addAnswerHistory(
      pergunta || "Pergunta desconhecida",
      resposta || "resposta vazia",
      isCorrectStr,
      session.nivelAtual || "Nível desconhecido",
      session.lastSubject || "Assunto desconhecido"
    );
  }

  userAnalysis.totalCorrectAnswers = (userAnalysis.totalCorrectAnswers || 0) + acertos;
  userAnalysis.totalWrongAnswers = (userAnalysis.totalWrongAnswers || 0) + erros;

  lastSession.totalCorrectAnswers = (lastSession.totalCorrectAnswers || 0) + acertos;
  lastSession.totalWrongAnswers = (lastSession.totalWrongAnswers || 0) + erros;

  const subjectStats: Record<string, { accessed: number; correct: number; wrong: number }> = {};

  for (const session of userAnalysis.sessions) {
    for (const history of session.answerHistory || []) {
      for (const question of history.questions || []) {
        const subject = question.subject;
        if (!subjectStats[subject]) {
          subjectStats[subject] = { accessed: 0, correct: 0, wrong: 0 };
        }
        subjectStats[subject].accessed += 1;
        subjectStats[subject].correct += question.totalCorrectAnswers || 0;
        subjectStats[subject].wrong += question.totalWrongAnswers || 0;
      }
    }
  }

  let mostAccessed = null,
    leastAccessed = null;
  let maxAccessed = -1,
    minAccessed = Infinity;

  for (const [subject, stats] of Object.entries(subjectStats)) {
    if (stats.accessed > maxAccessed) {
      mostAccessed = subject;
      maxAccessed = stats.accessed;
    }
    if (stats.accessed < minAccessed) {
      leastAccessed = subject;
      minAccessed = stats.accessed;
    }
  }

  if (
    !lastSession.sessionBot ||
    !Array.isArray(lastSession.sessionBot) ||
    lastSession.sessionBot.length === 0
  ) {
    lastSession.sessionBot = [
      {
        mostAccessedSubject: { subject: null, count: 0 },
        leastAccessedSubject: { subject: null, count: 0 },
        subjectFrequency: {},
      },
    ];
  }

  const botStats = lastSession.sessionBot[0];

  botStats.mostAccessedSubject = {
    subject: typeof mostAccessed === "string" ? mostAccessed : null,
    count: mostAccessed ? subjectStats[mostAccessed]?.accessed || 0 : 0,
  };

  botStats.leastAccessedSubject = {
    subject: typeof leastAccessed === "string" ? leastAccessed : null,
    count: leastAccessed ? subjectStats[leastAccessed]?.accessed || 0 : 0,
  };

  botStats.subjectFrequency = Object.fromEntries(
    Object.entries(subjectStats).map(([key, value]) => [key, value.accessed])
  );

  try {
    await userAnalysis.save();
  } catch (error: any) {
    console.error("Erro ao salvar respostas:", error);
    throw new AppError("Erro ao salvar as respostas: " + error.message, 500);
  }

  return {
    message:
      acertos === respostas.length
        ? "🎉 Parabéns! Acertou todas!"
        : "⚠️ Confira seu resultado:",
    totalCorrectAnswers: acertos,
    totalWrongAnswers: erros,
    detalhes: {
      questions: lastSession.answerHistory.at(-1)?.questions || [],
    },
  };
}
