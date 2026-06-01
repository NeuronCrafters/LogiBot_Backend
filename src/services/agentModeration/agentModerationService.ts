import { containsBadWord } from "../../utils/restrictWords";

interface ModerationResponse {
  safe: boolean;
  reason: string | null;
}

export class AgentModerationService {
  async checkContent(text: string): Promise<ModerationResponse> {
    const badWordCheck = containsBadWord(text);

    if (badWordCheck.found) {
      return {
        safe: false,
        reason: "Sua mensagem contem termos ofensivos ou inadequados que violam nossas diretrizes.",
      };
    }

    return { safe: true, reason: null };
  }
}
