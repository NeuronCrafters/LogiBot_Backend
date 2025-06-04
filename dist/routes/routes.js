"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = void 0;
const express_1 = require("express");
const authRoute_1 = require("./routesPaths/authRoute");
const socialLoginRoute_1 = require("./routesPaths/socialLoginRoute");
const adminRoute_1 = require("./routesPaths/adminRoute");
const passwordRoute_1 = require("./routesPaths/passwordRoute");
const rasaRoute_1 = require("./routesPaths/rasaRoute");
const academicInstitutionRoute_1 = require("./routesPaths/academicInstitutionRoute");
const academicRoutes_1 = require("./routesPaths/academicRoutes");
const logsRoutes_1 = require("./routesPaths/logsRoutes");
const userAnalysisRoutes_1 = require("./routesPaths/userAnalysisRoutes");
const routes = (0, express_1.Router)();
exports.routes = routes;
// Rotas de autenticação
routes.use("/", authRoute_1.authRoute);
// Rotas de login social
routes.use("/", socialLoginRoute_1.socialLoginRoute);
// Rotas protegidas para admin e coordenador de curso (middlewares já estão dentro do `adminRouter.ts`)
routes.use("/admin", adminRoute_1.adminRouter);
// Rotas de redefinição de senha
routes.use("/password", passwordRoute_1.passwordRouter);
// Rotas do SAEL (middlewares já estão dentro do `rasaRouter.ts`)
routes.use("/sael", rasaRoute_1.rasaRouter);
//Rota para pegar os logs do usuario
routes.use("/logs", logsRoutes_1.logRoutes);
// Rotas de instituições acadêmicas (middlewares já estão dentro do `academicInstitutionRouter.ts`)
routes.use("/academic-institution", academicInstitutionRoute_1.academicInstitutionRouter);
// Rota pública para consultar a lista de universidades, cursos e turmas para usar na rota de cadastro
routes.use("/academicFilters", academicRoutes_1.academicRoutes);
routes.use("/useranalysis", userAnalysisRoutes_1.useAnalysis);
