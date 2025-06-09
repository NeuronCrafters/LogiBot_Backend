// src/services/rasa/ActionService/verificarRespostasService.ts

import { AppError } from "../../../exceptions/AppError";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { RasaSessionData } from "../types/RasaSessionData";

const normalizeOption = (value: string) =>
  value.replace(/options\s*/i, "").trim().toLowerCase().replace(/\s+/g, "");

function gerarFeedback(acertos: number, total: number, subject: string): string {
  const percentual = (acertos / total) * 100;
  if (percentual === 100) {
    return `🏆 Excelente! Você acertou todas as ${total} perguntas sobre ${subject}!`;
  } else if (percentual >= 80) {
    return `👏 Muito bom! ${acertos}/${total} certas em ${subject}.`;
  } else if (percentual >= 60) {
    return `📚 ${acertos}/${total} certas. Continue praticando ${subject}!`;
  } else {
    return `🔄 ${acertos}/${total} certas. Ainda há bastante espaço para melhorar em ${subject}!`;
  }
}

function gerarExplicacaoErro(pergunta: string, respostaUsuario: string, respostaCorreta: string): string {
  return `❌ Pergunta: "${pergunta}" | Você respondeu: "${respostaUsuario.toUpperCase()}", mas a correta era: "${respostaCorreta.toUpperCase()}".`;
}

export async function verificarRespostasService(
  respostas: string[],
  userId: string,
  email: string,
  session: RasaSessionData,
  role: string | string[]
) {
  if (!session.lastAnswerKeys || !session.lastQuestions || session.lastAnswerKeys.length === 0 || session.lastQuestions.length === 0) {
    throw new AppError("Gabarito ou perguntas não definidos.", 400);
  }

  if (respostas.length !== session.lastAnswerKeys.length) {
    throw new AppError("Número de respostas não corresponde ao número de perguntas.", 400);
  }

  let acertos = 0;
  let erros = 0;
  const feedbackDetalhado: string[] = [];
  const detalhes: any[] = [];

  const isStudent = Array.isArray(role) ? role.includes("student") : role === "student";

  if (!isStudent) {
    for (let i = 0; i < respostas.length; i++) {
      const pergunta = session.lastQuestions[i];
      const gabarito = session.lastAnswerKeys[i];
      const certo = normalizeOption(respostas[i]) === normalizeOption(gabarito);

      if (certo) {
        acertos++;
      } else {
        erros++;
        feedbackDetalhado.push(gerarExplicacaoErro(pergunta, respostas[i], gabarito));
      }

      detalhes.push({
        question: pergunta,
        selected: respostas[i].toUpperCase(),
        correct: normalizeOption(gabarito).toUpperCase(),
        isCorrect: certo
      });
    }

    return {
      message: gerarFeedback(acertos, respostas.length, session.lastSubject || "assunto"),
      totalCorrectAnswers: acertos,
      totalWrongAnswers: erros,
      feedback: feedbackDetalhado,
      detalhes,
      subject: session.lastSubject || "assunto",
      nivel: session.nivelAtual || "Nível"
    };
  }

  // Se for estudante, salva no banco
  const ua = await UserAnalysis.findOne({ userId, email }).populate("schoolId").populate("courseId").populate("classId").exec();
  if (!ua) throw new AppError("Usuário não encontrado.", 404);

  if (ua.sessions.length === 0 || ua.sessions[ua.sessions.length - 1].sessionEnd) {
    ua.sessions.push({
      sessionStart: new Date(),
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      answerHistory: []
    });
  }

  const lastSessionIndex = ua.sessions.length - 1;

  const newAttempt = {
    questions: [],
    totalCorrectWrongAnswersSession: { totalCorrectAnswers: 0, totalWrongAnswers: 0 }
  };

  if (!ua.sessions[lastSessionIndex].answerHistory) {
    ua.sessions[lastSessionIndex].answerHistory = [];
  }

  ua.sessions[lastSessionIndex].answerHistory.push(newAttempt);
  const newAttemptIndex = ua.sessions[lastSessionIndex].answerHistory.length - 1;

  if (session.lastSubject) ua.updateSubjectCountsQuiz(session.lastSubject);

  for (let i = 0; i < respostas.length; i++) {
    const pergunta = session.lastQuestions[i];
    const gabarito = session.lastAnswerKeys[i];
    const certo = normalizeOption(respostas[i]) === normalizeOption(gabarito);

    if (certo) acertos++;
    else {
      erros++;
      feedbackDetalhado.push(gerarExplicacaoErro(pergunta, respostas[i], gabarito));
    }

    const question = {
      level: session.nivelAtual || "Nível",
      subject: session.lastSubject || "Assunto",
      selectedOption: {
        question: pergunta,
        isCorrect: certo,
        isSelected: respostas[i]
      },
      correctAnswer: normalizeOption(gabarito).toUpperCase(),
      totalCorrectAnswers: certo ? 1 : 0,
      totalWrongAnswers: certo ? 0 : 1,
      timestamp: new Date()
    };

    detalhes.push(question);
    ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].questions.push(question);

    if (certo) ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].totalCorrectWrongAnswersSession.totalCorrectAnswers++;
    else ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].totalCorrectWrongAnswersSession.totalWrongAnswers++;
  }

  ua.totalCorrectWrongAnswers.totalCorrectAnswers += acertos;
  ua.totalCorrectWrongAnswers.totalWrongAnswers += erros;
  ua.sessions[lastSessionIndex].totalCorrectAnswers += acertos;
  ua.sessions[lastSessionIndex].totalWrongAnswers += erros;

  ua.markModified(`sessions.${lastSessionIndex}.answerHistory`);
  ua.markModified(`subjectCountsQuiz`);
  await ua.save();

  return {
    message: gerarFeedback(acertos, respostas.length, session.lastSubject || "assunto"),
    totalCorrectAnswers: acertos,
    totalWrongAnswers: erros,
    feedback: feedbackDetalhado,
    detalhes,
    subject: session.lastSubject || "assunto",
    nivel: session.nivelAtual || "Nível"
  };
}
