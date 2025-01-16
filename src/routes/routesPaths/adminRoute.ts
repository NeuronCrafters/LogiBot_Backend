import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { isAuthorized } from "../../middlewares/isAuthorized/isAuthorized";
import { ListProfessorsController } from "../../controllers/admin/ListProfessorsController";
import { ListStudentsProfessorController } from "../../controllers/admin/ListStudentsProfessorController";
import { ViewStudentHistoryController } from "../../controllers/admin/ViewStudentHistoryController";

const adminRouter = Router();

adminRouter.get("/professors", isAuthenticated, isAuthorized(["admin", "course-coordinator"]), new ListProfessorsController().handle);

adminRouter.get("/professor/:professorId/students", isAuthenticated, isAuthorized(["admin", "course-coordinator"]), new ListStudentsProfessorController().handle);

adminRouter.get("/student/:studentId/history", isAuthenticated, isAuthorized(["admin", "course-coordinator"]), new ViewStudentHistoryController().handle);

export { adminRouter };
