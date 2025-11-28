import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";
import { AppError } from "../../exceptions/AppError";
import { UserAnalysis } from "../../models/UserAnalysis";

interface DecodedToken extends JwtPayload {
    id: string;
    name: string;
    email: string;
    role: string | string[];
    school?: string;
}

function normalizeRoles(roleField: string | string[] | null | undefined): string[] {
    if (!roleField) return [];
    if (Array.isArray(roleField)) return roleField.filter(Boolean);
    return [roleField];
}

export async function isAuthenticated(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const token = req.cookies.token;
    if (!token) {
        return next(new AppError("não autenticado: token ausente", 401));
    }

    try {
        const secret = process.env.JWT_SECRET!;
        const decoded = jwt.verify(token, secret) as DecodedToken;

        if (normalizeRoles(decoded.role).includes("student")) {
            const userAnalysis = await UserAnalysis.findOne({ userId: decoded.id });
            if (userAnalysis) {
                const lastSession = userAnalysis.sessions.at(-1);
                if (lastSession && lastSession.sessionEnd) {
                    res.clearCookie("token");
                    throw new AppError("sua sessão expirou. por favor, faça o login novamente.", 401);
                }
            }
        }

        console.log("[isauthenticated] token decodificado:", {
            id: decoded.id, name: decoded.name, email: decoded.email, role: decoded.role
        });

        if (normalizeRoles(decoded.role).includes("admin")) {
            const user = await User.findById(decoded.id);
            if (!user) throw new AppError("Usuário admin não encontrado.", 401);
            if (user.status !== "active") throw new AppError("Acesso negado. Sua conta está inativa.", 403);
            req.user = {
                id: user._id.toString(), name: user.name, email: user.email, role: normalizeRoles(decoded.role), school: user.school?.toString() || null, courses: null, classes: null
            };
            return next();
        }

        if (normalizeRoles(decoded.role).some(r => ["professor", "course-coordinator"].includes(r))) {
            const professor = await Professor.findById(decoded.id).select("name email role school courses classes status");
            if (!professor) throw new AppError("Professor não encontrado.", 401);
            if (professor.status !== "active") throw new AppError("Acesso negado. Sua conta está inativa.", 403);
            req.user = {
                id: professor._id.toString(), name: professor.name, email: professor.email, role: normalizeRoles(decoded.role), school: professor.school?.toString() || null, courses: professor.courses?.map(c => c.toString()) || [], classes: professor.classes?.map(c => c.toString()) || []
            };
            console.log("[isauthenticated] professor autenticado:", req.user);
            return next();
        }

        const user = await User.findById(decoded.id);
        if (!user) throw new AppError("Usuário não encontrado.", 401);
        if (user.status !== "active") throw new AppError("Acesso negado. Sua conta está inativa.", 403);
        req.user = {
            id: user._id.toString(), name: user.name, email: user.email, role: normalizeRoles(decoded.role), school: user.school?.toString() || null, courses: user.course?.toString() || null, classes: user.class?.toString() || null
        };
        console.log("[isauthenticated] usuário autenticado:", req.user);
        return next();

    } catch (error) {
        res.clearCookie("token");
        if (error instanceof jwt.JsonWebTokenError) {
            return next(new AppError("Token inválido.", 401));
        }
        return next(error);
    }
}