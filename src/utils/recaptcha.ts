import axios from "axios";
import { AppError } from "../exceptions/AppError";

export async function verifyRecaptcha(token?: string): Promise<void> {
    if (!token) {
        throw new AppError("Token reCAPTCHA ausente.", 400);
    }

    const secret = process.env.RECAPTCHA_SECRET_KEY;
    if (!secret) {
        throw new AppError("RECAPTCHA_SECRET_KEY não definida no servidor.", 500);
    }

    try {
        const response = await axios.post(
            "https://www.google.com/recaptcha/api/siteverify",
            null,
            {
                params: {
                    secret,
                    response: token,
                },
                timeout: 5000,
            }
        );

        const data: {
            success: boolean;
            challenge_ts?: string;
            hostname?: string;
            'error-codes'?: string[]
        } = response.data;

        if (!data.success) {

            throw new AppError("Falha na verificação do reCAPTCHA. Tente novamente.", 403);
        }

        console.log("recaptcha verificado com sucesso:", {
            challenge_ts: data.challenge_ts,
            hostname: data.hostname
        });
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }


        throw new AppError("Erro na verificação do reCAPTCHA. Tente novamente.", 500);
    }
}