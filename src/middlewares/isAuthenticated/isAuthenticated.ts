import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

// Corrigindo a tipagem para o que de fato existe no token
interface DecodedToken extends JwtPayload {
  id: string; // <-- aqui o id correto que você está injetando no JWT
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

export async function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: "Não autenticado: token ausente" });
  }

  try {
    const secret = process.env.JWT_SECRET || "default_secret";
    const decoded = jwt.verify(token, secret) as DecodedToken;

    // Agora buscamos o usuário no banco usando decoded.id (e não sub)
    let user: any = await User.findById(decoded.id);
    let isProfessor = false;

    if (!user) {
      user = await Professor.findById(decoded.id);
      isProfessor = true;
    }

    if (!user) {
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: normalizeRoles(decoded.role),
      school: user.school || null,
      courses: isProfessor ? user.courses : user.course,
      classes: isProfessor ? undefined : user.class
    };

    return next();
  } catch (error) {
    console.error("[isAuthenticated] Erro:", error);
    return res.status(401).json({ error: "Token inválido." });
  }
}
