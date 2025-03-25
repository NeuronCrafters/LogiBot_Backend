import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { ListStudentsController } from "../../controllers/professor/listStudentsController";

const professorRouter = Router();

// Listar alunos de um professor (somente Admin e Coordenadores)
professorRouter.get("/:professorId/students", ...isPermissions.isAdminOrCoordinator(), new ListStudentsController().handle);

export { professorRouter };
