import { AppError } from "../../../exceptions/AppError";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { RasaSessionData } from "../types/RasaSessionData";

export async function verificarRespostasService(
  respostas: string[],
  userId: string,
  email: string,
  session: RasaSessionData,
  role: string | string[]
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

  const isStudent = Array.isArray(role)
    ? role.includes("student")
    : role === "student";

  if (!isStudent) {
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

  // — fluxo completo para estudantes —
  const userAnalysis = await UserAnalysis.findOne({ userId, email });
  if (!userAnalysis || !userAnalysis.sessions?.length) {
    throw new AppError("Usuário ou sessão não encontrada.", 404);
  }

  const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];

  for (let i = 0; i < respostas.length; i++) {
    const resposta = respostas[i];
    const gabarito = session.lastAnswerKeys[i];
    const pergunta = session.lastQuestions[i];

    const isCorrect = normalizeOption(resposta) === normalizeOption(gabarito);
    if (isCorrect) acertos++;
    else erros++;

    userAnalysis.addAnswerHistory(
      pergunta || "Pergunta desconhecida",
      resposta || "resposta vazia",
      isCorrect ? "true" : "false",
      session.nivelAtual || "Nível desconhecido",
      session.lastSubject || "Assunto desconhecido"
    );
  }

  userAnalysis.totalCorrectAnswers += acertos;
  userAnalysis.totalWrongAnswers += erros;
  lastSession.totalCorrectAnswers = (lastSession.totalCorrectAnswers || 0) + acertos;
  lastSession.totalWrongAnswers = (lastSession.totalWrongAnswers || 0) + erros;

  // recalcula estatísticas por assunto
  const subjectStats: Record<string, { accessed: number; correct: number; wrong: number }> = {};
  for (const sess of userAnalysis.sessions) {
    for (const hist of sess.answerHistory || []) {
      for (const q of hist.questions || []) {
        const subj = q.subject;
        if (!subjectStats[subj]) {
          subjectStats[subj] = { accessed: 0, correct: 0, wrong: 0 };
        }
        subjectStats[subj].accessed++;
        subjectStats[subj].correct += q.totalCorrectAnswers || 0;
        subjectStats[subj].wrong += q.totalWrongAnswers || 0;
      }
    }
  }

  let mostAccessed: string | null = null,
    leastAccessed: string | null = null;
  let maxAcc = -1,
    minAcc = Infinity;

  for (const [subj, stats] of Object.entries(subjectStats)) {
    if (stats.accessed > maxAcc) {
      mostAccessed = subj;
      maxAcc = stats.accessed;
    }
    if (stats.accessed < minAcc) {
      leastAccessed = subj;
      minAcc = stats.accessed;
    }
  }

  if (!Array.isArray(lastSession.sessionBot) || lastSession.sessionBot.length === 0) {
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
    subject: mostAccessed,
    count: mostAccessed ? subjectStats[mostAccessed].accessed : 0,
  };
  botStats.leastAccessedSubject = {
    subject: leastAccessed,
    count: leastAccessed ? subjectStats[leastAccessed].accessed : 0,
  };
  botStats.subjectFrequency = Object.fromEntries(
    Object.entries(subjectStats).map(([k, v]) => [k, v.accessed])
  );

  try {
    await userAnalysis.save();
  } catch (err: any) {
    console.error("Erro ao salvar respostas:", err);
    throw new AppError("Erro ao salvar as respostas: " + err.message, 500);
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
