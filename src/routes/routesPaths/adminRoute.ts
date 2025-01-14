import { Router } from "express";
import { ListProfessorsController } from "../../controllers/admin/ListProfessorsController";
import { ListStudentsProfessorController } from "../../controllers/admin/ListStudentsProfessorController";
import { ViewStudentHistoryController } from "../../controllers/admin/ViewStudentHistoryController";

const adminRouter = Router();

adminRouter.get("/professors", new ListProfessorsController().handle);
adminRouter.get("/professor/:professorId/students", new ListStudentsProfessorController().handle);
adminRouter.get("/student/:studentId/history", new ViewStudentHistoryController().handle);

export { adminRouter };
