import { Router } from "express";
import { ListProfessorsController } from "../../controllers/admin/ListProfessorsController";
import { ListStudentsController } from "../../controllers/admin/ListStudentsController";
import { ViewStudentHistoryController } from "../../controllers/admin/ViewStudentHistoryController";

const adminRouter = Router();

adminRouter.get("/professors", new ListProfessorsController().handle);
adminRouter.get("/professor/:professorId/students", new ListStudentsController().handle);
adminRouter.get("/student/:studentId/history", new ViewStudentHistoryController().handle);

export { adminRouter };
