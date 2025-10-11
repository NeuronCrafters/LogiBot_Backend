import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { LogoutUserService } from "../../services/users/LogoutUserService";
import { AppError } from "../../exceptions/AppError";

class LogoutUserController {
    async handle(req: Request, res: Response) {
        try {
            const token = req.cookies.token;

            if (!token) {
                res.clearCookie("token");
                throw new AppError("Token não fornecido.", 401);
            }

            const decoded: any = jwt.verify(token, process.env.JWT_SECRET!);

            if (!decoded || !decoded.sub) {
                throw new AppError("Token inválido.", 401);
            }

            const userId = decoded.sub;

            const logoutUserService = new LogoutUserService();
            const result = await logoutUserService.logout(userId);

            res.clearCookie("token");

            return res.status(200).json(result);
        } catch (error: any) {
            res.clearCookie("token");
            if (error instanceof AppError) {
                return res.status(error.statusCode).json({ error: error.message });
            }
            return res.status(500).json({ error: "Erro interno no servidor." });
        }
    }
}

export { LogoutUserController };