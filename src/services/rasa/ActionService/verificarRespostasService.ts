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
  // validações iniciais do Rasa
  if (
      !session.lastAnswerKeys ||
      !session.lastQuestions ||
      session.lastAnswerKeys.length === 0 ||
      session.lastQuestions.length === 0
  ) {
    throw new AppError("Gabarito ou perguntas não definidos.", 400);
  }
  if (respostas.length !== session.lastAnswerKeys.length) {
    throw new AppError(
        "Número de respostas não corresponde ao número de perguntas.",
        400
    );
  }

  // função auxiliar para normalizar strings
  const normalizeOption = (value: string) =>
      value
          .replace(/options\s*/i, "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "");

  let acertos = 0;
  let erros   = 0;

  const isStudent = Array.isArray(role)
      ? role.includes("student")
      : role === "student";

  // fluxo para usuários que NÃO são estudantes
  if (!isStudent) {
    const detalhes = session.lastQuestions.map((question, idx) => {
      const resposta = respostas[idx];
      const gabarito = session.lastAnswerKeys[idx];
      const certo    = normalizeOption(resposta) === normalizeOption(gabarito);
      if (certo) acertos++;
      else erros++;

      return {
        level: session.nivelAtual || "Nível desconhecido",
        subject: session.lastSubject || "Assunto desconhecido",
        selectedOption: {
          question,
          isCorrect: certo ? "true" : "false",
          isSelected: resposta,
        },
        totalCorrectAnswers: certo ? 1 : 0,
        totalWrongAnswers:   certo ? 0 : 1,
        timestamp:           new Date(),
      };
    });

    return {
      message:
          acertos === respostas.length
              ? "🎉 Parabéns! Acertou todas!"
              : "⚠️ Confira seu resultado:",
      totalCorrectAnswers: acertos,
      totalWrongAnswers:   erros,
      detalhes: { questions: detalhes },
    };
  }

  // fluxo completo para estudantes

  // busca o UserAnalysis e popula schoolId, courseId e classId com seus nomes
  const ua = await UserAnalysis.findOne({ userId, email })
      .populate("schoolId", "name")
      .populate("courseId", "name")
      .populate("classId",  "name")
      .exec();

  if (!ua || ua.sessions.length === 0) {
    throw new AppError("Usuário ou sessão não encontrada.", 404);
  }

  const lastSession = ua.sessions.at(-1)!;

  // registra cada resposta no history e conta acertos/erros
  for (let i = 0; i < respostas.length; i++) {
    const resposta = respostas[i];
    const gabarito = session.lastAnswerKeys[i];
    const pergunta = session.lastQuestions[i];
    const certo    = normalizeOption(resposta) === normalizeOption(gabarito);

    if (certo) acertos++;
    else erros++;

    // nova assinatura: (level, question, subject, selectedOption, isCorrect)
    ua.addAnswerHistory(
        session.nivelAtual  || "Nível desconhecido",
        pergunta || "Pergunta desconhecida",
        session.lastSubject || "Assunto desconhecido",
        resposta || "",
        certo
    );
  }

  // atualiza totais globais
  ua.totalCorrectWrongAnswers.totalCorrectAnswers += acertos;
  ua.totalCorrectWrongAnswers.totalWrongAnswers   += erros;

  // atualiza totais da última sessão
  lastSession.totalCorrectAnswers =
      (lastSession.totalCorrectAnswers || 0) + acertos;
  lastSession.totalWrongAnswers =
      (lastSession.totalWrongAnswers || 0) + erros;

  // persiste no banco
  try {
    await ua.save();
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
    totalWrongAnswers:   erros,
    detalhes: {
      questions: lastSession.quizHistory.at(-1)!.questions,
    },
  };
}
