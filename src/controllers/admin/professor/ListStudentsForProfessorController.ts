import { Request, Response } from "express";
import { ListStudentsForProfessorService } from "../../../services/admin/professor/ListStudentsForProfessorService";

async function ListStudentsForProfessorController(
  req: Request,
  res: Response
) {

  const user = req.user as { id: string; role: string[] };

  if (!user.role.includes("professor")) {
    return res.status(403).json({ message: "Acesso negado." });
  }

  const students = await ListStudentsForProfessorService(user.id);
  return res.json(students);
}

export { ListStudentsForProfessorController }