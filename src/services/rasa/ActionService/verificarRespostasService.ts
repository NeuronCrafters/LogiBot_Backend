import axios from "axios";
import { AppError } from "../../../exceptions/AppError";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { RasaSessionData } from "../types/RasaSessionData";

const RASA_ACTION_URL = process.env.RASA_ACTION as string;

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
): Promise<QuizResultData & { source: "rasa" }> {
  // 1) Validações básicas
  if (
    !session.lastAnswerKeys?.length ||
    !session.lastQuestions?.length
  ) {
    throw new AppError("Sessão inválida: perguntas ou gabarito ausentes.", 400);
  }
  if (respostas.length !== session.lastAnswerKeys.length) {
    throw new AppError("Número de respostas não corresponde ao número de perguntas.", 400);
  }

  // 2) Chama action_check_answers, preenchendo o slot respostas_usuario
  let rasaResp;
  try {
    rasaResp = await axios.post(RASA_ACTION_URL, {
      next_action: "action_check_answers_with_gpt",
      tracker: {
        sender_id: userId,
        slots: {
          respostas_usuario: respostas,
        },
      },
    });
  } catch (err: any) {
    if (err.response) {
      throw new AppError(`Erro no servidor de correção: ${err.response.statusText}`, 502);
    }
    throw new AppError("Não foi possível conectar ao servidor de correção.", 503);
  }

  // 3) Verifica a estrutura da resposta e extrai o conteúdo correto
  const responses = rasaResp.data.responses;

  // Procura a resposta com o payload estruturado
  let structuredResponse = null;
  for (const response of responses) {
    if (response.custom?.type === "quiz_result") {
      structuredResponse = response.custom.data;
      break;
    }
  }

  if (!structuredResponse) {
    console.error("Resposta inesperada do Rasa:", JSON.stringify(rasaResp.data, null, 2));
    throw new AppError("Resposta do servidor de correção mal formatada.", 502);
  }

  const result: QuizResultData = structuredResponse;

  // 4) Se for estudante, persiste no UserAnalysis
  const isStudent = Array.isArray(role)
    ? role.includes("student")
    : role === "student";

  if (isStudent) {
    const ua = await UserAnalysis.findOne({ userId, email }).exec();
    if (!ua) throw new AppError("Usuário não encontrado.", 404);

    if (!ua.sessions.length || ua.sessions[ua.sessions.length - 1].sessionEnd) {
      ua.sessions.push({
        sessionStart: new Date(),
        totalCorrectAnswers: 0,
        totalWrongAnswers: 0,
        answerHistory: [],
      });
    }
    const si = ua.sessions.length - 1;

    ua.sessions[si].answerHistory.push({
      questions: result.detalhes.map((d) => ({
        level: session.nivelAtual || "Nível",
        subject: session.lastSubject || "assunto",
        selectedOption: {
          question: d.question,
          isCorrect: d.isCorrect,
          isSelected: d.selected,
        },
        explanation: d.explanation,
        totalCorrectAnswers: d.isCorrect ? 1 : 0,
        totalWrongAnswers: d.isCorrect ? 0 : 1,
        timestamp: new Date(),
      })),
      totalCorrectWrongAnswersSession: {
        totalCorrectAnswers: result.totalCorrectAnswers,
        totalWrongAnswers: result.totalWrongAnswers,
      },
    });

    ua.sessions[si].totalCorrectAnswers += result.totalCorrectAnswers;
    ua.sessions[si].totalWrongAnswers += result.totalWrongAnswers;
    ua.totalCorrectWrongAnswers.totalCorrectAnswers += result.totalCorrectAnswers;
    ua.totalCorrectWrongAnswers.totalWrongAnswers += result.totalWrongAnswers;

    ua.markModified(`sessions.${si}`);
    await ua.save();
  }

  // 5) Retorna o resultado
  return {
    ...result,
    source: "rasa",
  };
}