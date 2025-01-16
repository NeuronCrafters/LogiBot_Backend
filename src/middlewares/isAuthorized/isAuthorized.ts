import { Request, Response, NextFunction } from "express";
import { AppError } from "../../exceptions/AppError";

export function isAuthorized(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRoles = Array.isArray(req.user?.role) ? req.user.role : [req.user?.role];

    if (!allowedRoles.some((role) => userRoles.includes(role))) {
      throw new AppError("Acesso negado. Você não tem permissão.", 403);
    }

    next();
  };
}
