import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { isAuthorized } from "../../middlewares/isAuthorized/isAuthorized";
import { CreateProfessorController } from "../../controllers/admin/createProfessorController";
import { ListProfessorsController } from "../../controllers/admin/ListProfessorsController";
import { ListStudentsProfessorController } from "../../controllers/admin/ListStudentsProfessorController";

const adminRouter = Router();
const isAdminOrCoordinator = [isAuthenticated, isAuthorized(["admin", "course-coordinator"])];
const isAdmin = [isAuthenticated, isAuthorized(["admin"])];

// Rotas para criar Professores
adminRouter.post("/professor", ...isAdmin, new CreateProfessorController().handle);

// rota de listagem de professores
adminRouter.get("/professors", ...isAdminOrCoordinator, new ListProfessorsController().handle);

// rota de listagem dos alunos de um professor
adminRouter.get("/professor/:professorId/students", ...isAdminOrCoordinator, new ListStudentsProfessorController().handle);

export { adminRouter };
