import axios from 'axios';
import { AppError } from "../../../exceptions/AppError";

interface RasaMessage {
    text?: string;
    custom?: {
        type: string;
        data: any;
    };
}

interface RasaResponse {
    recipient_id: string;
    text?: string;
    custom?: {
        type: string;
        data: QuizResultData;
    };
}

interface QuizResultData {
    message: string;
    totalCorrectAnswers: number;
    totalWrongAnswers: number;
    detalhes: {
        questions: Array<{
            level: string;
            subject: string;
            selectedOption: {
                question: string;
                isCorrect: boolean;
                isSelected: string;
            };
            correctAnswer: string;
            totalCorrectAnswers: number;
            totalWrongAnswers: number;
            timestamp: string;
        }>;
    };
    detailedFeedback: string[];
    percentage: number;
    subject: string;
    nivel: string;
}

class RasaVerificationService {
    private readonly rasaUrl: string;

    constructor() {
        this.rasaUrl = process.env.RASA_URL || 'http://localhost:5005';
    }

    async verificarRespostasComRasa(
        userId: string,
        respostas: string[]
    ): Promise<QuizResultData> {
        try {
            const respostasFormatadas = respostas.join(',');

            const payload = {
                sender: userId,
                message: respostasFormatadas,
                metadata: {
                    action: "verificar_respostas",
                    respostas: respostas
                }
            };

            console.log(`🤖 Enviando respostas para Rasa - User: ${userId}`);
            console.log(`📝 Respostas: ${respostasFormatadas}`);

            const response = await axios.post(
                `${this.rasaUrl}/webhooks/rest/webhook`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 5000,
                }
            );

            const rasaMessages: RasaResponse[] = response.data;

            if (!rasaMessages || rasaMessages.length === 0) {
                throw new AppError("Nenhuma resposta recebida do Rasa", 500);
            }

            const resultMessage = rasaMessages.find(
                msg => msg.custom?.type === 'quiz_result'
            );

            if (!resultMessage || !resultMessage.custom?.data) {
                const textMessages = rasaMessages
                    .filter(msg => msg.text && msg.text.trim() !== '')
                    .map(msg => msg.text)
                    .join(' ');

                if (textMessages) {
                    console.log("⚠️ Rasa retornou apenas texto, usando fallback");
                    return this.createFallbackResult(textMessages, respostas.length);
                }

                throw new AppError("Formato de resposta inválido do Rasa", 500);
            }

            const resultData = resultMessage.custom.data;

            if (
                typeof resultData.totalCorrectAnswers !== 'number' ||
                typeof resultData.totalWrongAnswers !== 'number' ||
                !resultData.message
            ) {
                throw new AppError("Dados incompletos na resposta do Rasa", 500);
            }

            console.log(`✅ Resultado recebido do Rasa:`);
            console.log(`📊 Acertos: ${resultData.totalCorrectAnswers}/${respostas.length}`);
            console.log(`💬 Mensagem: ${resultData.message}`);

            return resultData;

        } catch (error: any) {
            console.error("❌ Erro ao comunicar com Rasa:", error.message);

            if (error instanceof AppError) {
                throw error;
            }

            if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                throw new AppError(
                    "Serviço de verificação temporariamente indisponível. Tente novamente em alguns minutos.",
                    503
                );
            }

            if (error.response?.status === 404) {
                throw new AppError("Endpoint de verificação não encontrado", 404);
            }

            if (error.response?.status >= 500) {
                throw new AppError("Erro interno do serviço de verificação", 500);
            }

            throw new AppError(
                `Erro na verificação das respostas: ${error.message}`,
                500
            );
        }
    }

    private createFallbackResult(textMessage: string, totalQuestions: number): QuizResultData {
        const acertosMatch = textMessage.match(/(\d+)\/(\d+)/);
        const acertos = acertosMatch ? parseInt(acertosMatch[1]) : 0;
        const erros = totalQuestions - acertos;

        return {
            message: textMessage,
            totalCorrectAnswers: acertos,
            totalWrongAnswers: erros,
            detalhes: {
                questions: []
            },
            detailedFeedback: [],
            percentage: (acertos / totalQuestions) * 100,
            subject: "programação",
            nivel: "desconhecido"
        };
    }

    async testarConexaoRasa(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.rasaUrl}/status`, {
                timeout: 5000
            });

            return response.status === 200;
        } catch (error) {
            console.error("❌ Rasa não está acessível:", error);
            return false;
        }
    }

    async executarActionRasa(
        userId: string,
        actionName: string,
        additionalData: any = {}
    ): Promise<RasaResponse[]> {
        try {
            const payload = {
                sender: userId,
                message: `/action_trigger{"action_name":"${actionName}"}`,
                metadata: {
                    forced_action: actionName,
                    ...additionalData
                }
            };

            const response = await axios.post(
                `${this.rasaUrl}/webhooks/rest/webhook`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    timeout: 15000,
                }
            );

            return response.data;
        } catch (error: any) {
            console.error(`❌ Erro ao executar action ${actionName}:`, error.message);
            throw new AppError(`Erro ao executar action: ${error.message}`, 500);
        }
    }
}

export { RasaVerificationService, QuizResultData };