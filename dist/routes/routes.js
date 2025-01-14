"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = void 0;
const express_1 = require("express");
const authRoute_1 = require("./routesPaths/authRoute");
const adminRoute_1 = require("./routesPaths/adminRoute");
const professorRoute_1 = require("./routesPaths/professorRoute");
const isAuthenticated_1 = require("../middlewares/isAuthenticated");
const isAuthorized_1 = require("../middlewares/isAuthorized");
const routes = (0, express_1.Router)();
exports.routes = routes;
// Rotas de autenticação
routes.use("/", authRoute_1.authRoute);
// Rotas protegidas para admin
routes.use("/admin", isAuthenticated_1.isAuthenticated, (0, isAuthorized_1.isAuthorized)("admin"), adminRoute_1.adminRouter);
// Rotas protegidas para professor
routes.use("/professor", isAuthenticated_1.isAuthenticated, (0, isAuthorized_1.isAuthorized)("professor"), professorRoute_1.professorRouter);
