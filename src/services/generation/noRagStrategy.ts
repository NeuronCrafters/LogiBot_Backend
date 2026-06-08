import { logger } from "../../logger";
import { askDigitalOceanAgent } from "../ai/digitalOceanAgentService";
import type { AgentMessage } from "../ai/digitalOceanAgentService";
import {
  measureChatTiming,
  type GenerationInput,
  type GenerationResult,
} from "./generationTypes";

const FALLBACK_TEXT =
  "Tive um problema tecnico ao processar sua mensagem. Pode tentar novamente?";

const DEFAULT_SYSTEM_PROMPT =
  "Voce e o LogiBot, um tutor educacional especializado em logica de programacao, algoritmos e tecnologia, respondendo sempre em portugues do Brasil. " +
  "Mantenha o foco em: logica de programacao, algoritmos, estruturas de dados, linguagens de programacao, desenvolvimento web/backend/frontend, banco de dados, sistemas operacionais, redes e ferramentas de desenvolvimento. " +
  "Se a pergunta estiver fora desses temas, nao responda o assunto diretamente. Redirecione gentilmente dizendo que seu foco e programacao e tecnologia.";

export async function generateNoRagResponse(
  input: GenerationInput,
): Promise<GenerationResult> {
  logger.info("NoRAG", "Generating response without retrieval.", {
    classId: input.settings?.classId ?? null,
  });

  const systemPrompt = input.settings?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const messages: AgentMessage[] = [
    { role: "system", content: systemPrompt },
    ...input.history,
  ];
  const agentResponse = await measureChatTiming(input.timings, "agent", () =>
    askDigitalOceanAgent(messages),
  );

  return {
    text: agentResponse?.text ?? FALLBACK_TEXT,
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks: [],
  };
}
