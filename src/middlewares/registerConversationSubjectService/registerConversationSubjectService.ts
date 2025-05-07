import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

const subjectKeywords = {
  variaveis: ["variavel", "variáveis", "variables", "var", "varíavel", "variaeis"],
  listas: ["lista", "listas", "arrays", "vetores", "list", "vetor", "vetorr", "vetores"],
  condicionais: ["condicional", "condicionais", "if", "else", "elif", "se", "caso", "condiciona", "condição"],
  operadores: ["operador", "operadores", "operation", "operations", "operacoes", "operands", "aritmetico", "logico"],
  laços: ["laço", "laços", "loop", "loops", "for", "while", "repetição", "laco", "lacos"],
  funções: ["função", "funções", "function", "functions", "def", "procedimento", "método", "metodo"],
  tipos: ["tipo", "tipos", "tipagem", "tipado", "mutavel", "imutavel", "string", "inteiro", "float", "booleano"],
};

export async function registerConversationSubject(userId: string, userMessage: string) {
  const userAnalysis = await UserAnalysis.findOne({ userId });

  if (!userAnalysis || userAnalysis.sessions.length === 0) {
    throw new AppError("Nenhuma sessão ativa encontrada para este usuário.", 404);
  }

  const lastSession = userAnalysis.sessions[userAnalysis.sessions.length - 1];
  if (lastSession.sessionEnd) {
    throw new AppError("A sessão já foi encerrada.", 400);
  }

  const messageLower = userMessage.toLowerCase();
  const subjectFrequency = userAnalysis.subjectFrequency || {};

  for (const [subject, keywords] of Object.entries(subjectKeywords)) {
    if (keywords.some(keyword => messageLower.includes(keyword))) {
      subjectFrequency[subject] = (subjectFrequency[subject] || 0) + 1;
    }
  }

  userAnalysis.subjectFrequency = subjectFrequency;

  userAnalysis.addInteraction(userMessage);
  await userAnalysis.save();
}
