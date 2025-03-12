import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { AssignDisciplineController } from "../../controllers/University/UniversityOuthers/AssignDisciplineController";
import { CreateClassController } from "../../controllers/University/Class/CreateClassController";
import { DeleteClassController } from "../../controllers/University/Class/DeleteClassController";
import { ListClassesByCourseController } from "../../controllers/University/Class/ListClassesByCourseController";
import { CreateCourseController } from "../../controllers/University/Course/CreateCourseController";
import { DeleteCourseController } from "../../controllers/University/Course/DeleteCourseController";
import { ListCoursesByUniversityController } from "../../controllers/University/Course/ListCoursesByUniversityController";
import { CreateDisciplineController } from "../../controllers/University/Discipline/CreateDisciplineController";
import { DeleteDisciplineController } from "../../controllers/University/Discipline/DeleteDisciplineController";
import { ListDisciplinesController } from "../../controllers/University/Discipline/ListDisciplinesController";
import { CreateUniversityController } from "../../controllers/University/University/CreateUniversityController";
import { DeleteUniversityController } from "../../controllers/University/University/DeleteUniversityController";
import { ListUniversitiesController } from "../../controllers/University/University/ListUniversitiesController";
import { GetClassWithStudentsController } from "../../controllers/University/UniversityOuthers/GetClassWithStudentsController";

const academicInstitutionRouter = Router();

// Rotas para Universidades (Somente Admin)
academicInstitutionRouter.post("/university", ...isPermissions.isAdmin(), new CreateUniversityController().handle);
academicInstitutionRouter.get("/university", ...isPermissions.isAdmin(), new ListUniversitiesController().handle);
academicInstitutionRouter.delete("/university/:universityId", ...isPermissions.isAdmin(), new DeleteUniversityController().handle);

// Rotas para Cursos (Somente Admin)
academicInstitutionRouter.post("/course", ...isPermissions.isAdmin(), new CreateCourseController().handle);
academicInstitutionRouter.get("/course/:universityId", ...isPermissions.isAdmin(), new ListCoursesByUniversityController().handle);
academicInstitutionRouter.delete("/course/:courseId", ...isPermissions.isAdmin(), new DeleteCourseController().handle);

// Rotas para Turmas (Admin e Coordenadores)
academicInstitutionRouter.post("/class", ...isPermissions.isAdminOrCoordinator(), new CreateClassController().handle);
academicInstitutionRouter.get("/class/:courseId", ...isPermissions.isAdminOrCoordinator(), new ListClassesByCourseController().handle);
academicInstitutionRouter.delete("/class/:classId", ...isPermissions.isAdminOrCoordinator(), new DeleteClassController().handle);

// Rotas para Disciplinas (Admin e Coordenadores)
academicInstitutionRouter.post("/discipline", ...isPermissions.isAdminOrCoordinator(), new CreateDisciplineController().handle);
academicInstitutionRouter.get("/discipline", ...isPermissions.isAdminOrCoordinator(), new ListDisciplinesController().handle);
academicInstitutionRouter.delete("/discipline/:disciplineId", ...isPermissions.isAdminOrCoordinator(), new DeleteDisciplineController().handle);

// Rota para associar um aluno a uma disciplina (Admin e Coordenadores)
academicInstitutionRouter.post("/assign-discipline", ...isPermissions.isAdminOrCoordinator(), new AssignDisciplineController().handle);

// Rota para listar alunos de uma turma específica (Admin e Coordenadores)
academicInstitutionRouter.get("/class/:classId/students", ...isPermissions.isAdminOrCoordinator(), new GetClassWithStudentsController().handle);

export { academicInstitutionRouter };
