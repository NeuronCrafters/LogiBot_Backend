import type { AgentMessage } from "../ai/digitalOceanAgentService";

const MAX_PREVIOUS_USER_MESSAGES = 2;
const MAX_MESSAGE_LENGTH = 500;

const CONTINUATION_START_PATTERN =
  /^(e|mas|entao|então|agora|tambem|também|sobre|quanto a|ja|já)\b/i;
const REFERENTIAL_PATTERN =
  /\b(isso|isto|esse|essa|esses|essas|ele|ela|eles|elas|anterior|mesmo|mesma|outro|outra|tambem|também)\b/i;
const ELLIPTICAL_START_PATTERN = /^(um|uma|outro|outra)\b/i;
const COMPARISON_PATTERN =
  /^(qual|quais)\b.*\b(diferenca|diferença|melhor|pior|exemplo)\b/i;

function compactMessage(content: string) {
  return content.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE_LENGTH);
}

function comparableMessage(content: string) {
  return compactMessage(content).toLocaleLowerCase("pt-BR");
}

function isLikelyFollowUp(message: string) {
  const compact = compactMessage(message);
  if (!compact) return false;

  const wordCount = compact.split(/\s+/).length;

  return (
    CONTINUATION_START_PATTERN.test(compact) ||
    REFERENTIAL_PATTERN.test(compact) ||
    COMPARISON_PATTERN.test(compact) ||
    (wordCount <= 5 && ELLIPTICAL_START_PATTERN.test(compact))
  );
}

function getPreviousUserMessages(
  history: AgentMessage[],
  currentMessage: string,
) {
  const userMessages = history
    .filter((message) => message.role === "user")
    .map((message) => compactMessage(message.content))
    .filter(Boolean);

  const currentComparable = comparableMessage(currentMessage);
  const latestUserMessage = userMessages[userMessages.length - 1];

  // O chat salva a pergunta atual antes de carregar o historico. Removemos
  // apenas a ultima ocorrencia equivalente para manter repeticoes anteriores.
  if (
    latestUserMessage &&
    comparableMessage(latestUserMessage) === currentComparable
  ) {
    userMessages.pop();
  }

  return userMessages.slice(-MAX_PREVIOUS_USER_MESSAGES);
}

export type RagRetrievalQuery = {
  query: string;
  contextualized: boolean;
  previousUserMessageCount: number;
};

export function buildRagRetrievalQuery(input: {
  message: string;
  history: AgentMessage[];
}): RagRetrievalQuery {
  const currentMessage = compactMessage(input.message);
  const previousUserMessages = getPreviousUserMessages(
    input.history,
    currentMessage,
  );

  if (!previousUserMessages.length || !isLikelyFollowUp(currentMessage)) {
    return {
      query: currentMessage,
      contextualized: false,
      previousUserMessageCount: 0,
    };
  }

  const recentContext = [...previousUserMessages]
    .reverse()
    .map((message, index) => `${index + 1}. ${message}`)
    .join("\n");

  return {
    query: `Pergunta atual: ${currentMessage}

A pergunta atual continua a conversa. Use as perguntas anteriores apenas para resolver referencias, assunto, linguagem de programacao e tecnologia mencionada.

Perguntas anteriores do aluno, da mais recente para a mais antiga:
${recentContext}`,
    contextualized: true,
    previousUserMessageCount: previousUserMessages.length,
  };
}
