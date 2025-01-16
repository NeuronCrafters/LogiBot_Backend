import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

interface DecodedToken extends JwtPayload {
  id: string;
  name: string;
  email: string;
  role: string | string[];
  school?: string;
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
      role: Array.isArray(decoded.role) ? decoded.role : [decoded.role],
      school: decoded.school || "",
    };


    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token inválido." });
  }
}
