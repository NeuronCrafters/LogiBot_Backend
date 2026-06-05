import { logger } from "../../logger";
import { askDigitalOceanAgent } from "../ai/digitalOceanAgentService";
import type { GenerationInput, GenerationResult } from "./generationTypes";

const FALLBACK_TEXT =
  "Tive um problema tecnico ao processar sua mensagem. Pode tentar novamente?";

export async function generateNoRagResponse(
  input: GenerationInput,
): Promise<GenerationResult> {
  logger.info("NoRAG", "Generating response without retrieval.");
  const agentResponse = await askDigitalOceanAgent(input.history);

  return {
    text: agentResponse?.text ?? FALLBACK_TEXT,
    provider: agentResponse?.provider ?? "fallback",
    retrievedChunks: [],
  };
}

