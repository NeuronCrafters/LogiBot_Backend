import { Request, Response, NextFunction } from "express";
import { AppError } from "../exceptions/AppError";

export function isAuthorized(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (userRole !== role) {
      throw new AppError("Acesso negado. Você não tem permissão.", 403);
    }

    next();
  };
}
