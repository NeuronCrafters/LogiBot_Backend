import axios from 'axios';
import { containsBadWord } from '../../utils/restrictWords';

interface ModerationResponse {
  safe: boolean;
  reason: string | null;
}

export class AgentModerationService {
  private baseUrl: string;
  private key: string;
  private model: string;

  constructor() {
    this.baseUrl = process.env.Agent_Moderation || '';
    this.key = process.env.Key_Moderation || '';
    this.model = process.env.OLLAMA_MODEL || 'llama3.1';
  }

  async checkContent(text: string): Promise<ModerationResponse> {
    console.log(`[AgentModeration] Analisando: "${text}"`);

    const badWordCheck = containsBadWord(text);

    if (badWordCheck.found) {
      console.warn(`[AgentModeration] Bloqueio Local: Termo proibido detectado (${badWordCheck.word})`);
      return {
        safe: false,
        reason: "Sua mensagem contém termos ofensivos ou inadequados que violam nossas diretrizes."
      };
    }

    if (!this.baseUrl || !this.key) {
      return { safe: true, reason: null };
    }

    try {
      const response = await axios.post(
        this.baseUrl,
        {
          model: this.model,
          stream: false,
          messages: [
            {
              role: "system",
              content: `Você é um filtro de profanidade extremista (Zero Tolerance).
              
              SUA ÚNICA MISSÃO: Detectar se o texto contém:
              1. Palavrões (mesmo que usados como expressão, ex: "tá foda", "que merda").
              2. Ofensas pessoais, ironia agressiva ou insultos.
              3. Discurso de ódio.
              
              Se houver QUALQUER indício de ofensa, safe deve ser false.
              
              Responda APENAS o JSON cru:
              { "safe": boolean, "reason": "motivo curto em pt-br ou null" }`
            },
            {
              role: "user",
              content: text
            }
          ],
          options: { temperature: 0 }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.key}`
          },
          timeout: 8000
        }
      );

      const content = response.data?.choices?.[0]?.message?.content;

      if (!content) throw new Error("Retorno vazio do LLM");

      const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
      const analysis = JSON.parse(cleanContent);

      if (typeof analysis.safe !== 'boolean') {
        throw new Error("JSON mal formatado");
      }

      return {
        safe: analysis.safe,
        reason: analysis.reason
      };

    } catch (error) {
      return { safe: true, reason: null };
    }
  }
}