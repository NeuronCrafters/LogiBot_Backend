import { Router } from "express";
import { authRoute } from "./routesPaths/authRoute";
import { socialLoginRoute } from "./routesPaths/socialLoginRoute";
import { adminRouter } from "./routesPaths/adminRoute";
import { passwordRouter } from "./routesPaths/passwordRoute";
import { rasaRouter } from "./routesPaths/rasaRoute";
import { academicInstitutionRouter } from "./routesPaths/academicInstitutionRoute";
import { publicAcademicRoute } from "./routesPaths/academicPublicRoutes";
import { logRoutes } from "./routesPaths/logsRoutes";

const routes = Router();

// Rotas de autenticação
routes.use("/", authRoute);

// Rotas de login social
routes.use("/", socialLoginRoute);

// Rotas protegidas para admin e coordenador de curso (middlewares já estão dentro do `adminRouter.ts`)
routes.use("/admin", adminRouter);

// Rotas de redefinição de senha
routes.use("/password", passwordRouter);

// Rotas do SAEL (middlewares já estão dentro do `rasaRouter.ts`)
routes.use("/sael", rasaRouter);

//Rota para pegar os logs do usuario
routes.use("/logs", logRoutes)

// Rotas de instituições acadêmicas (middlewares já estão dentro do `academicInstitutionRouter.ts`)
routes.use("/academic-institution", academicInstitutionRouter);

// Rota pública para consultar a lista de universidades, cursos e turmas para usar na rota de cadastro
routes.use("/public", publicAcademicRoute);

export { routes };