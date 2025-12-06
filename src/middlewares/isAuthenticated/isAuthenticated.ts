import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import { UserAnalysis } from "../../models/UserAnalysis";
import { AppError } from "../../exceptions/AppError";

interface DecodedToken extends JwtPayload {
    id: string;
    name: string;
    email: string;
    role: string | string[];
    school?: string;
}

function normalizeRoles(roleField: string | string[] | null | undefined): string[] {
    if (!roleField) return [];
    return Array.isArray(roleField) ? roleField.filter(Boolean) : [roleField];
}

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies.token;
    if (!token) {
        return next(new AppError("não autenticado: token ausente", 401));
    }

    try {
        const secret = process.env.JWT_SECRET!;
        const decoded = jwt.verify(token, secret) as DecodedToken;
        const roles = normalizeRoles(decoded.role);

        if (roles.includes("student")) {
            const userAnalysis = await UserAnalysis.findOne({ userId: decoded.id });
            if (userAnalysis) {
                const lastSession = userAnalysis.sessions.at(-1);
                if (lastSession?.sessionEnd) {
                    res.clearCookie("token");
                    throw new AppError("sua sessão expirou. por favor, faça o login novamente.", 401);
                }
            }
        }

        if (roles.includes("admin")) {
            const user = await User.findById(decoded.id);
            if (!user) throw new AppError("usuário admin não encontrado.", 401);
            if (user.status !== "active") throw new AppError("acesso negado. sua conta está inativa.", 403);

            req.user = {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: roles,
                school: user.school?.toString() || null,
                courses: null,
                classes: null,
            };
            return next();
        }

        if (roles.some(r => ["professor", "course-coordinator"].includes(r))) {
            const professor = await Professor.findById(decoded.id)
                .select("name email role school courses classes status");
            if (!professor) throw new AppError("professor não encontrado.", 401);
            if (professor.status !== "active") throw new AppError("acesso negado. sua conta está inativa.", 403);

            req.user = {
                id: professor._id.toString(),
                name: professor.name,
                email: professor.email,
                role: roles,
                school: professor.school?.toString() || null,
                courses: professor.courses?.map(c => c.toString()) || [],
                classes: professor.classes?.map(c => c.toString()) || [],
            };
            return next();
        }

        const user = await User.findById(decoded.id);
        if (!user) throw new AppError("usuário não encontrado.", 401);
        if (user.status !== "active") throw new AppError("acesso negado. sua conta está inativa.", 403);

        req.user = {
            id: user._id.toString(),
            name: user.name,
            email: user.email,
            role: roles,
            school: user.school?.toString() || null,
            courses: user.course?.toString() || null,
            classes: user.class?.toString() || null,
        };

        return next();

    } catch (error) {
        res.clearCookie("token");
        if (error instanceof jwt.JsonWebTokenError) {
            return next(new AppError("token inválido.", 401));
        }
        return next(error);
    }
}
