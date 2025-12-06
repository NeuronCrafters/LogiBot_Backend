import { Request, Response } from "express";
import { AuthUserService } from "../../services/users/AuthUserService";
import { AppError } from "../../exceptions/AppError";
import { verifyRecaptcha } from "../../utils/recaptcha";

class AuthUserController {
    async handle(req: Request, res: Response) {
        try {
            console.log("requisição recebida no backend - corpo:", {
                email: req.body.email,
                hasPassword: !!req.body.password,
                hasGoogleId: !!req.body.googleId,
                hasRecaptchaToken: !!req.body.recaptchaToken
            });

            const { email, password, googleId, recaptchaToken } = req.body;

            if (!googleId) {
                await verifyRecaptcha(recaptchaToken);
            }

            const authUserService = new AuthUserService();
            const result = await authUserService.signin({ email, password, googleId });

            const { token, ...userData } = result;

            res.cookie("token", token, {
                httpOnly: true,
                //secure: process.env.NODE_ENV === "production",
                secure: true,
                //sameSite: "lax",
                sameSite: "none",
                maxAge: 1000 * 60 * 60 * 2,
                domain: process.env.COOKIE_DOMAIN
            });

            return res.json({
                success: true,
                user: userData,
                message: "Login realizado com sucesso!"
            });

        } catch (error: any) {
            if (error instanceof AppError) {

                return res.status(error.statusCode).json({
                    success: false,
                    message: error.message
                });
            }


            return res.status(500).json({
                success: false,
                message: "Erro interno no servidor.",
                error: process.env.NODE_ENV === "development" ? error.message : undefined
            });
        }
    }
}

export { AuthUserController };