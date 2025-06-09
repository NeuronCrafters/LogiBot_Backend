import { Request, Response } from "express";
import { RasaVerificationService, QuizResultData } from "../../../services/rasa/ActionService/verificarRespostasService";
import { verificarRespostasService } from "../../../services/rasa/ActionService/verificarRespostasService";
import { getSession } from "../../../services/rasa/types/sessionMemory";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { AppError } from "../../../exceptions/AppError";

export async function verificarRespostasController(req: Request, res: Response) {
  try {
    const { respostas, useRasaVerification = true } = req.body;

    // Validação básica
    if (!Array.isArray(respostas)) {
      return res.status(400).json({
        message: "As respostas são obrigatórias e devem estar em um array.",
      });
    }

    const userId = req.user.id;
    const email = req.user.email;
    const role = req.user.role;

    console.log(`🎯 Iniciando verificação de respostas para usuário ${userId}`);
    console.log(`📝 Respostas recebidas: ${respostas.join(', ')}`);
    console.log(`🤖 Usar verificação Rasa: ${useRasaVerification}`);

    // Se habilitado, tentar usar o Rasa primeiro
    if (useRasaVerification) {
      try {
        const rasaService = new RasaVerificationService();

        // Testar conexão com Rasa
        const rasaDisponivel = await rasaService.testarConexaoRasa();

        if (rasaDisponivel) {
          console.log("🤖 Rasa disponível, usando verificação humanizada...");

          // Usar o Rasa para verificar e gerar feedback humanizado
          const resultadoRasa = await rasaService.verificarRespostasComRasa(userId, respostas);

          // Para estudantes, ainda precisamos salvar no banco de dados
          const isStudent = Array.isArray(role) ? role.includes("student") : role === "student";

          if (isStudent) {
            console.log("👨‍🎓 Usuário é estudante, salvando dados no banco...");

            // Garantir que o UserAnalysis exista e tenha uma sessão ativa
            await ensureUserAnalysisSession(userId, email);

            // Salvar os dados no banco usando uma versão adaptada do service original
            await salvarResultadoNoBanco(
              resultadoRasa,
              respostas,
              userId,
              email
            );
          }

          console.log("✅ Verificação com Rasa concluída com sucesso");

          return res.status(200).json({
            ...resultadoRasa,
            source: "rasa_humanized"
          });
        } else {
          console.log("⚠️ Rasa indisponível, usando método tradicional...");
        }
      } catch (rasaError: any) {
        console.error("❌ Erro no Rasa, fallback para método tradicional:", rasaError.message);

        // Se o erro for crítico, informar ao usuário
        if (rasaError instanceof AppError && rasaError.statusCode >= 500) {
          console.log("🔄 Usando verificação tradicional como fallback...");
        }
      }
    }

    // Fallback: usar o método tradicional
    console.log("📚 Usando verificação tradicional...");

    const session = getSession(userId);

    if (!session?.lastAnswerKeys?.length || !session?.lastQuestions?.length) {
      return res.status(400).json({
        message: "Sessão inválida: perguntas ou gabarito ausentes.",
      });
    }

    // Garantir que o UserAnalysis exista
    let ua = await UserAnalysis.findOne({ userId, email }).exec();
    if (!ua) {
      return res.status(404).json({
        message: "Usuário não encontrado.",
      });
    }

    if (!ua.sessions) {
      ua.sessions = [];
    }

    const needsNewSession = ua.sessions.length === 0 ||
      (ua.sessions[ua.sessions.length - 1].sessionEnd !== undefined);

    if (needsNewSession) {
      console.log("📝 Criando nova sessão para o usuário", userId);
      ua.sessions.push({
        sessionStart: new Date(),
        totalCorrectAnswers: 0,
        totalWrongAnswers: 0,
        subjectCountsChat: {
          variaveis: 0,
          tipos: 0,
          funcoes: 0,
          loops: 0,
          verificacoes: 0
        },
        answerHistory: []
      });

      await ua.save();
      ua = await UserAnalysis.findOne({ userId, email }).exec();
      if (!ua) {
        throw new AppError("Erro ao recarregar dados do usuário após criar sessão", 500);
      }
    }

    // Usar o service tradicional
    const result = await verificarRespostasService(
      respostas,
      userId,
      email,
      session,
      role
    );

    console.log("✅ Verificação tradicional concluída");

    return res.status(200).json({
      ...result,
      source: "traditional"
    });

  } catch (error: any) {
    console.error("❌ Erro no controller de verificação:", error);

    if (error instanceof AppError) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    return res.status(500).json({
      message: error.message || "Erro ao verificar respostas",
    });
  }
}

/**
 * Garante que o usuário tenha um UserAnalysis com sessão ativa
 */
async function ensureUserAnalysisSession(userId: string, email: string): Promise<void> {
  let ua = await UserAnalysis.findOne({ userId, email }).exec();

  if (!ua) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  if (!ua.sessions) {
    ua.sessions = [];
  }

  const needsNewSession = ua.sessions.length === 0 ||
    (ua.sessions[ua.sessions.length - 1].sessionEnd !== undefined);

  if (needsNewSession) {
    ua.sessions.push({
      sessionStart: new Date(),
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      subjectCountsChat: {
        variaveis: 0,
        tipos: 0,
        funcoes: 0,
        loops: 0,
        verificacoes: 0
      },
      answerHistory: []
    });

    await ua.save();
  }
}

/**
 * Salva o resultado do Rasa no banco de dados do usuário
 */
async function salvarResultadoNoBanco(
  resultadoRasa: QuizResultData,
  respostas: string[],
  userId: string,
  email: string
): Promise<void> {
  const ua = await UserAnalysis.findOne({ userId, email }).exec();

  if (!ua) {
    throw new AppError("Usuário não encontrado para salvar resultado.", 404);
  }

  const lastSessionIndex = ua.sessions.length - 1;

  const newAttempt = {
    questions: [],
    totalCorrectWrongAnswersSession: {
      totalCorrectAnswers: resultadoRasa.totalCorrectAnswers,
      totalWrongAnswers: resultadoRasa.totalWrongAnswers
    }
  };

  if (!ua.sessions[lastSessionIndex].answerHistory) {
    ua.sessions[lastSessionIndex].answerHistory = [];
  }

  ua.sessions[lastSessionIndex].answerHistory.push(newAttempt);
  const newAttemptIndex = ua.sessions[lastSessionIndex].answerHistory.length - 1;

  // Atualizar contadores de assunto
  if (resultadoRasa.subject) {
    ua.updateSubjectCountsQuiz(resultadoRasa.subject);
  }

  // Adicionar questões do resultado do Rasa
  resultadoRasa.detalhes.questions.forEach((question) => {
    const questionData = {
      level: question.level,
      subject: question.subject,
      selectedOption: {
        question: question.selectedOption.question,
        isCorrect: question.selectedOption.isCorrect,
        isSelected: question.selectedOption.isSelected,
      },
      correctAnswer: question.correctAnswer,
      totalCorrectAnswers: question.totalCorrectAnswers,
      totalWrongAnswers: question.totalWrongAnswers,
      timestamp: new Date(),
    };

    ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].questions.push(questionData);
  });

  // Atualizar totais da sessão
  ua.sessions[lastSessionIndex].totalCorrectAnswers += resultadoRasa.totalCorrectAnswers;
  ua.sessions[lastSessionIndex].totalWrongAnswers += resultadoRasa.totalWrongAnswers;

  // Atualizar totais gerais
  ua.totalCorrectWrongAnswers.totalCorrectAnswers += resultadoRasa.totalCorrectAnswers;
  ua.totalCorrectWrongAnswers.totalWrongAnswers += resultadoRasa.totalWrongAnswers;

  ua.markModified(`sessions.${lastSessionIndex}.answerHistory`);
  ua.markModified(`subjectCountsQuiz`);

  await ua.save();

  console.log(`💾 Resultado do Rasa salvo no banco para usuário ${userId}`);
}