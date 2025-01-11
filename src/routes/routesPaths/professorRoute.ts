import { Router } from "express";
import { ListStudentsController } from "../../controllers/professor/listStudentsController";
import { ViewStudentHistoryController } from "../../controllers/professor/viewStudentHistoryController";

const professorRouter = Router();

professorRouter.get("/:professorId/students", new ListStudentsController().handle);
professorRouter.get("/:professorId/student/:studentId/history", new ViewStudentHistoryController().handle);

export { professorRouter };
