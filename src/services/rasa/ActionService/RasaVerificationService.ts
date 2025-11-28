import axios from 'axios';
import { AppError } from "../../../exceptions/AppError";
import { QuizResultData } from "../types/QuizResultData";

interface RasaResponse {
    recipient_id: string;
    text?: string;
    custom?: {
        type: string;
        data: QuizResultData;
    };
}

class RasaVerificationService {
    private readonly rasaUrl: string;

    constructor() {
        this.rasaUrl = process.env.RASA_URL!;
    }

    async verificarRespostasComRasa(userId: string, respostas: string[]): Promise<QuizResultData> {
        try {
            const respostasFormatadas = respostas.join(',');

            const payload = {
                sender: userId,
                message: respostasFormatadas,
                metadata: { action: "verificar_respostas", respostas }
            };

            const response = await axios.post(`${this.rasaUrl}/webhooks/rest/webhook`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000,
            });

            const rasaMessages: RasaResponse[] = response.data;

            if (!rasaMessages || rasaMessages.length === 0) {
                throw new AppError("nenhuma resposta recebida do rasa", 500);
            }

            const resultMessage = rasaMessages.find(msg => msg.custom?.type === 'quiz_result');

            if (!resultMessage || !resultMessage.custom?.data) {

                throw new AppError("formato de resposta inválido do rasa", 500);
            }

            const data = resultMessage.custom.data;

            return data;

        } catch (error: any) {
            throw new AppError("erro ao comunicar com o rasa:" + (error.message || error), 500);
        }
    }

    async testarConexaoRasa(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.rasaUrl}/status`, { timeout: 5000 });
            return response.status === 200;
        } catch {
            return false;
        }
    }
}

export { RasaVerificationService };
