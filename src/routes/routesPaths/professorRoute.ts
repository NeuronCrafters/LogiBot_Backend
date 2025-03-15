// import { Router } from "express";
// import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
// import { ListStudentsController } from "../../controllers/professor/listStudentsController";
// import { ViewStudentHistoryController } from "../../controllers/professor/viewStudentHistoryController";

// const professorRouter = Router();

// // Listar alunos de um professor (somente Admin e Coordenadores)
// professorRouter.get("/:professorId/students", ...isPermissions.isAdminOrCoordinator(), new ListStudentsController().handle);

// // Visualizar histórico de um aluno específico (somente Admin e Coordenadores)
// professorRouter.get("/:professorId/student/:studentId/history", ...isPermissions.isAdminOrCoordinator(), new ViewStudentHistoryController().handle);

// export { professorRouter };
