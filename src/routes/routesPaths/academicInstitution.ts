import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { isAuthorized } from "../../middlewares/isAuthorized/isAuthorized";
import { AssignDisciplineController } from "../../controllers/University/AssignDisciplineController";
import { createClassController } from "../../controllers/University/createClassController";
import { createCourseController } from "../../controllers/University/createCourseController";
import { createDisciplineController } from "../../controllers/University/createDisciplineController";
import { CreateProfessorController } from "../../controllers/University/createProfessorController";
import { CreateUniversityController } from "../../controllers/University/createUniversityController";
import { GetClassWithStudentsController } from "@/controllers/University/GetClassWithStudentsController";

const academicInstitutionRouter = Router();

// Middleware para garantir autenticação e autorização
const isAdminOrCoordinator = [isAuthenticated, isAuthorized(["admin", "course-coordinator"])];
const isAdmin = [isAuthenticated, isAuthorized(["admin"])];

// Rotas para criar instituições e listar as mesmas (apenas Admin)
academicInstitutionRouter.post("/university", ...isAdmin, new CreateUniversityController().handle);
academicInstitutionRouter.get("/university", ...isAdmin, new CreateUniversityController().list);

// Rotas para criar Cursos e listar cursos (apenas Admin)
academicInstitutionRouter.post("/course", ...isAdmin, new createCourseController().handle);
academicInstitutionRouter.get("/course/:universityId", ...isAdmin, new createCourseController().list);

// Rotas para criar Turmas e listar as mesmas (Admin e Coordenadores)
academicInstitutionRouter.post("/class", ...isAdminOrCoordinator, new createClassController().handle);
academicInstitutionRouter.get("/class/:courseId", ...isAdminOrCoordinator, new createClassController().list);

// Rotas para criar Disciplinas e listar as mesmas (Admin e Coordenadores)
academicInstitutionRouter.post("/discipline", ...isAdminOrCoordinator, new createDisciplineController().handle);
academicInstitutionRouter.get("/discipline", ...isAdminOrCoordinator, new createDisciplineController().list);

// Rotas para criar Professores (apenas Admin)
academicInstitutionRouter.post("/professor", ...isAdmin, new CreateProfessorController().handle);

// Rota para associar um aluno a uma disciplina (Admin e Coordenadores)
academicInstitutionRouter.post("/assign-discipline", ...isAdminOrCoordinator, new AssignDisciplineController().handle);

// Rota para buscar uma turma específica e listar os seus alunos (Admin e Coordenadores)
academicInstitutionRouter.get("/class/:classId/students", ...isAdminOrCoordinator, new GetClassWithStudentsController().handle);

export { academicInstitutionRouter };
