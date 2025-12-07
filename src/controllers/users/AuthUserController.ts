import { Request, Response } from "express";
import { AuthUserService } from "../../services/users/AuthUserService";
import { AppError } from "../../exceptions/AppError";

function isProductionRequest(req: Request): boolean {
    const origin = req.get("origin") || "";
    const host = req.get("host") || "";
    return origin.includes("saellogibot.com") || host.includes("saellogibot.com");
}

class AuthUserController {
    async handle(req: Request, res: Response) {
        try {
            console.log("requisição recebida no backend - corpo:", {
                email: req.body.email,
                hasPassword: !!req.body.password,
                hasGoogleId: !!req.body.googleId,
                origin: req.get("origin"),
                host: req.get("host")
            });

            const { email, password, googleId } = req.body;

            const authUserService = new AuthUserService();
            const result = await authUserService.signin({ email, password, googleId });

            const { token, ...userData } = result;

            const isProduction = isProductionRequest(req);

            res.cookie("token", token, {
                httpOnly: true,
                secure: isProduction,
                sameSite: isProduction ? "none" : "lax",
                maxAge: 1000 * 60 * 60 * 2,
                domain: isProduction ? ".saellogibot.com" : undefined,
                path: "/"
            });

            console.log("cookie configurado:", {
                isProduction,
                secure: isProduction,
                sameSite: isProduction ? "none" : "lax",
                domain: isProduction ? ".saellogibot.com" : "undefined"
            });

            return res.json({
                success: true,
                user: userData,
                message: "login realizado com sucesso"
            });

        } catch (error: any) {
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({
                    success: false,
                    message: error.message
                });
            }

            console.error("erro interno no servidor:", error);
            return res.status(500).json({
                success: false,
                message: "erro interno no servidor"
            });
        }
    }
}

export { AuthUserController };