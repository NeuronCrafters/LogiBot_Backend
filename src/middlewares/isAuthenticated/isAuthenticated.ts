import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { User } from "../../models/User";
import { Professor } from "../../models/Professor";

/* ---------- tipagem mínima do token ---------- */
interface DecodedToken extends JwtPayload {
  id: string;
  name: string;
  email: string;
  role: string | string[];
  school?: string;
}

/* ---------- utilitário ---------- */
function normalizeRoles(roleField: string | string[] | null | undefined): string[] {
  if (!roleField) return [];
  if (Array.isArray(roleField)) return roleField.filter(Boolean);
  return [roleField];
}

/* ---------- middleware ---------- */
export async function isAuthenticated(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: "Não autenticado: token ausente" });
  }

  try {
    const secret = process.env.JWT_SECRET || "default_secret";
    const decoded = jwt.verify(token, secret) as DecodedToken;

    console.log("[isAuthenticated] Token decodificado:", {
      id: decoded.id,
      name: decoded.name,
      email: decoded.email,
      role: decoded.role
    });

    /* ---------- ADMIN ---------- */
    if (normalizeRoles(decoded.role).includes("admin")) {
      const user = await User.findById(decoded.id);
      if (!user) {
        console.log("[isAuthenticated] Admin não encontrado no modelo User");
        return res.status(401).json({ error: "Usuário admin não encontrado." });
      }

      req.user = {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: normalizeRoles(decoded.role),
        school: user.school?.toString() || null,
        courses: null,
        classes: null
      };

      console.log("[isAuthenticated] Admin autenticado:", req.user);
      return next();
    }

    /* ---------- PROFESSOR / COORDENADOR ---------- */
    if (normalizeRoles(decoded.role).some(r => ["professor", "course-coordinator"].includes(r))) {
      const professor = await Professor
        .findById(decoded.id)
        .select("name email role school courses classes");

      if (!professor) {
        console.log("[isAuthenticated] Professor não encontrado no modelo Professor");
        return res.status(401).json({ error: "Professor não encontrado." });
      }

      req.user = {
        id: professor._id.toString(),
        name: professor.name,
        email: professor.email,
        role: normalizeRoles(decoded.role),
        school: professor.school?.toString() || null,
        courses: professor.courses?.map(c => c.toString()) || [],   // ← agora array
        classes: professor.classes?.map(c => c.toString()) || []    // ← agora array
      };

      console.log("[isAuthenticated] Professor autenticado:", req.user);
      return next();
    }

    /* ---------- ESTUDANTE ---------- */
    const user = await User.findById(decoded.id);
    if (!user) {
      console.log("[isAuthenticated] Usuário não encontrado em nenhum modelo");
      return res.status(401).json({ error: "Usuário não encontrado." });
    }

    req.user = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: normalizeRoles(decoded.role),
      school: user.school?.toString() || null,
      courses: user.course?.toString() || null,
      classes: user.class?.toString() || null
    };

    console.log("[isAuthenticated] Usuário autenticado:", req.user);
    return next();
  } catch (error) {
    console.error("[isAuthenticated] Erro:", error);
    return res.status(401).json({ error: "Token inválido." });
  }
}
