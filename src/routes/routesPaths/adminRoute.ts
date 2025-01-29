import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateProfessorController } from "../../controllers/admin/CreateProfessorController";
import { ListProfessorsByCourseController } from "../../controllers/admin/ListProfessorsByCourseController";
import { DeleteProfessorController } from "../../controllers/admin/DeleteProfessorController";
import { ListProfessorsController } from "../../controllers/admin/ListProfessorsController";
import { ListStudentsProfessorController } from "../../controllers/admin/ListStudentsProfessorController";

const adminRouter = Router();

// Criar um novo professor
adminRouter.post("/professor", ...isPermissions.isAdmin(), new CreateProfessorController().handle);

// Listar todos os professores
adminRouter.get("/professors", ...isPermissions.isAdminOrCoordinator(), new ListProfessorsController().handle);

// Listar alunos de um professor específico
adminRouter.get("/professor/:professorId/students", ...isPermissions.isAdminOrCoordinator(), new ListStudentsProfessorController().handle);

// Listar professores de um curso específico
adminRouter.get("/course/:courseId/professors", ...isPermissions.isAdminOrCoordinator(), new ListProfessorsByCourseController().handle);

// Remover um professor
adminRouter.delete("/professor/:professorId", ...isPermissions.isAdmin(), new DeleteProfessorController().handle);

export { adminRouter };
