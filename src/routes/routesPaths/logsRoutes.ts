import { Router } from "express";
import { LogUserController } from "../../controllers/Logs/LogUserController";
import { LogDisciplineController } from "../../controllers/Logs/LogDisciplineController";
import { LogCourseController } from "../../controllers/Logs/LogCourseController";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { LogClassController } from "../../controllers/Logs/LogClassController";

const logRoutes = Router();

const userController = new LogUserController();
const disciplineController = new LogDisciplineController();
const courseController = new LogCourseController();
const classController = new LogClassController();

// logs de um usuário (admin, coordenador e aluno)
logRoutes.get("/user/:userId", isPermissions.isAdminProfessorOrCoordinator(), userController.getUserLogs.bind(userController));

// logs de uma turma (admin e coordenador)
logRoutes.get("/class/:classId", isPermissions.isAdminOrCoordinator(), classController.getClassLogs.bind(classController));

// logs de uma disciplina (admin, coordenador ou professor da disciplina)
logRoutes.get("/discipline/:disciplineId", isPermissions.isAdminProfessorOrCoordinator(), disciplineController.getDisciplineLogs.bind(disciplineController));

// logs de um curso (admin e coordenador)
logRoutes.get("/course/:courseId", isPermissions.isAdminOrCoordinator(), courseController.getCourseLogs.bind(courseController));

export { logRoutes };
