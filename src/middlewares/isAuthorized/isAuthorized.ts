import { Request, Response, NextFunction } from "express";
import { AppError } from "../../exceptions/AppError";

function normalizeRoles(roleField: string | string[] | null | undefined): string[] {
  if (!roleField) return [];
  if (Array.isArray(roleField)) return roleField.filter(Boolean);
  return [roleField];
}

export function isAuthorized(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = normalizeRoles(req.user?.role);

    if (!allowedRoles.some((role) => userRoles.includes(role))) {
      throw new AppError("Acesso negado. Você não tem permissão.", 403);
    }

    next();
  };
}
