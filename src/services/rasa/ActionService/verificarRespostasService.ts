import { AppError } from "../../../exceptions/AppError";
import { UserAnalysis } from "../../../models/UserAnalysis";
import { RasaSessionData } from "../types/RasaSessionData";

const mainSubjects = [
  "variaveis",
  "listas",
  "condicionais",
  "verificacoes",
  "tipos",
  "funcoes",
  "loops"
];

// Assuntos que são subcategorias de "tipos"
const typeSubjects = [
  "textos",
  "caracteres",
  "numeros",
  "operadores_matematicos",
  "operadores_logicos",
  "operadores_ternarios",
  "soma",
  "subtracao",
  "multiplicacao",
  "divisao_inteira",
  "divisao_resto",
  "divisao_normal"
];

// Lista completa de todos os assuntos disponíveis
const allSubjects = [...mainSubjects, ...typeSubjects];

// Função para verificar se um assunto é uma subcategoria de tipos
const isTypeSubject = (subject: string) => typeSubjects.includes(subject);

// Função para extrair o assunto principal de um subassunto (ex: "variaveis_o_que_e" -> "variaveis")
const extractMainSubject = (subject: string): string => {
  if (subject.includes('_')) {
    const mainPart = subject.split('_')[0];
    if (mainSubjects.includes(mainPart) || typeSubjects.includes(mainPart)) {
      return mainPart;
    }
  }
  return subject;
};

export async function verificarRespostasService(
    respostas: string[],
    userId: string,
    email: string,
    session: RasaSessionData,
    role: string | string[]
) {
  // Validação inicial dos dados de sessão
  if (!session.lastAnswerKeys || !session.lastQuestions ||
      session.lastAnswerKeys.length === 0 || session.lastQuestions.length === 0) {
    throw new AppError("Gabarito ou perguntas não definidos.", 400);
  }

  // Verifica se o número de respostas corresponde ao número de perguntas
  if (respostas.length !== session.lastAnswerKeys.length) {
    throw new AppError("Número de respostas não corresponde ao número de perguntas.", 400);
  }

  // Função para normalizar a resposta e comparações de opções
  const normalizeOption = (value: string) =>
      value.replace(/options\s*/i, "").trim().toLowerCase().replace(/\s+/g, "");

  // Contadores de acertos e erros
  let acertos = 0;
  let erros = 0;

  const isStudent = Array.isArray(role) ? role.includes("student") : role === "student";

  // Se não for um aluno, faz o processamento e retorna
  if (!isStudent) {
    const detalhes = session.lastQuestions.map((question, idx) => {
      const resposta = respostas[idx];
      const gabarito = session.lastAnswerKeys[idx];
      const certo = normalizeOption(resposta) === normalizeOption(gabarito);

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
        totalWrongAnswers: certo ? 0 : 1,
        timestamp: new Date(),
      };
    });

    return {
      message: acertos === respostas.length
          ? "🎉 Parabéns! Acertou todas!"
          : "⚠️ Confira seu resultado:",
      totalCorrectAnswers: acertos,
      totalWrongAnswers: erros,
      detalhes: { questions: detalhes },
    };
  }

  // Se for aluno, busca os dados de análise do usuário
  const ua = await UserAnalysis.findOne({ userId, email })
      .populate("schoolId", "name")
      .populate("courseId", "name")
      .populate("classId", "name")
      .exec();

  // Validação se o usuário existe
  if (!ua) {
    throw new AppError("Usuário não encontrado.", 404);
  }

  // Verificar se há uma sessão ativa
  if (ua.sessions.length === 0 || ua.sessions[ua.sessions.length - 1].sessionEnd) {
    // Não há sessão ativa, criar uma nova sessão
    ua.sessions.push({
      sessionStart: new Date(),
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0,
      answerHistory: []
    });
  }

  // Pegar o índice da última sessão para referência direta
  const lastSessionIndex = ua.sessions.length - 1;

  // Criar novo objeto de tentativa
  const newAttempt = {
    questions: [],
    totalCorrectWrongAnswersSession: {
      totalCorrectAnswers: 0,
      totalWrongAnswers: 0
    }
  };

  // Adiciona a nova tentativa na história de respostas da última sessão
  if (!ua.sessions[lastSessionIndex].answerHistory) {
    ua.sessions[lastSessionIndex].answerHistory = [];
  }

  ua.sessions[lastSessionIndex].answerHistory.push(newAttempt);

  // Índice da nova tentativa
  const newAttemptIndex = ua.sessions[lastSessionIndex].answerHistory.length - 1;

  // Atualiza o subjectCounts uma única vez por sessão, com o assunto principal atual
  // Isso é feito aqui, antes de processar as respostas individuais
  if (session.lastSubject) {
    ua.updateSubjectCount(session.lastSubject);
  }

  // Processa as respostas e atualiza os contadores de acertos/erros
  for (let i = 0; i < respostas.length; i++) {
    const resposta = respostas[i];
    const gabarito = session.lastAnswerKeys[i];
    const pergunta = session.lastQuestions[i];
    const certo = normalizeOption(resposta) === normalizeOption(gabarito);

    if (certo) acertos++;
    else erros++;

    // Adiciona a questão no histórico da nova tentativa
    const question = {
      level: session.nivelAtual || "Nível desconhecido",
      subject: session.lastSubject || "Assunto desconhecido",
      selectedOption: {
        question: pergunta || "Pergunta desconhecida",
        isCorrect: certo,
        isSelected: resposta || "",
      },
      totalCorrectAnswers: certo ? 1 : 0,
      totalWrongAnswers: certo ? 0 : 1,
      timestamp: new Date(),
    };

    ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].questions.push(question);

    // Atualiza os contadores de respostas corretas e erradas
    if (certo) {
      ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].totalCorrectWrongAnswersSession.totalCorrectAnswers += 1;
    } else {
      ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].totalCorrectWrongAnswersSession.totalWrongAnswers += 1;
    }
  }

  // Atualiza os totais de respostas corretas e erradas no usuário
  ua.totalCorrectWrongAnswers.totalCorrectAnswers += acertos;
  ua.totalCorrectWrongAnswers.totalWrongAnswers += erros;

  // Atualiza os totais de respostas corretas e erradas na última sessão
  ua.sessions[lastSessionIndex].totalCorrectAnswers += acertos;
  ua.sessions[lastSessionIndex].totalWrongAnswers += erros;

  // Marcar explicitamente os caminhos modificados para garantir que o Mongoose os salve
  ua.markModified(`sessions.${lastSessionIndex}.answerHistory`);
  ua.markModified(`subjectCounts`);

  // Salva o usuário com as novas informações de tentativas e sessões
  try {
    await ua.save();
  } catch (err: any) {
    console.error("Erro ao salvar respostas:", err);
    throw new AppError("Erro ao salvar as respostas: " + err.message, 500);
  }

  // A estrutura de retorno também pode ser simplificada para não expor detalhes internos
  return {
    message: acertos === respostas.length
        ? "🎉 Parabéns! Acertou todas!"
        : "⚠️ Confira seu resultado:",
    totalCorrectAnswers: acertos,
    totalWrongAnswers: erros,
    detalhes: {
      questions: ua.sessions[lastSessionIndex].answerHistory[newAttemptIndex].questions,
    },
  };
}