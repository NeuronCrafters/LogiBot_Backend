import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

interface DecodedToken extends JwtPayload {
  sub: string;
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

export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Token não fornecido." });
  }

  const [, token] = authHeader.split(" ");

  try {
    const secret = process.env.JWT_SECRET || "default_secret";
    const decoded = jwt.verify(token, secret) as DecodedToken;

    req.user = {
      id: decoded.sub,
      name: decoded.name,
      email: decoded.email,
      role: normalizeRoles(decoded.role),
      school: decoded.school || null,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido." });
  }
}
