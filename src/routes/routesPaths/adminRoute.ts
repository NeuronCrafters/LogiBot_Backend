import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { isAuthorized } from "../../middlewares/isAuthorized/isAuthorized";
import { ListProfessorsController } from "../../controllers/admin/ListProfessorsController";
import { ListStudentsProfessorController } from "../../controllers/admin/ListStudentsProfessorController";

const adminRouter = Router();

adminRouter.get("/professors", isAuthenticated, isAuthorized(["admin", "course-coordinator"]), new ListProfessorsController().handle);

adminRouter.get("/professor/:professorId/students", isAuthenticated, isAuthorized(["admin", "course-coordinator"]), new ListStudentsProfessorController().handle);

export { adminRouter };
