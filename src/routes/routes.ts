import { Router } from "express";
import { authRoute } from "./routesPaths/authRoute";
import { socialLoginRoute } from "./routesPaths/socialLoginRoute";
import { adminRouter } from "./routesPaths/adminRoute";
import { professorRouter } from "./routesPaths/professorRoute";
import { passwordRouter } from "./routesPaths/passwordRoute";
import { rasaRouter } from "./routesPaths/rasaRoute";
import { academicInstitutionRouter } from "./routesPaths/academicInstitutionRoute";
import { faqStoreRouter } from "./routesPaths/faqStoreRoute";
import { publicAcademicRoute } from "./routesPaths/academicPublicRoutes";

const routes = Router();

// Rotas de autenticação
routes.use("/", authRoute);

// Rotas de login social
routes.use("/", socialLoginRoute);

// Rotas protegidas para admin e coordenador de curso (middlewares já estão dentro do `adminRouter.ts`)
routes.use("/admin", adminRouter);

// Rotas protegidas para professor (middlewares já estão dentro do `professorRouter.ts`)
routes.use("/professor", professorRouter);

// Rotas de redefinição de senha
routes.use("/password", passwordRouter);

// Rotas do Rasa (middlewares já estão dentro do `rasaRouter.ts`)
routes.use("/sael", rasaRouter);

// Rotas de instituições acadêmicas (middlewares já estão dentro do `academicInstitutionRouter.ts`)
routes.use("/academic-institution", academicInstitutionRouter);

// Rota para o faqstore das perguntas e gabaritos
routes.use("/faq", faqStoreRouter);

// Rota pública para consultar a lista de universidades, cursos e turmas para usar na rota de cadastro
routes.use("/public", publicAcademicRoute);

export { routes };
