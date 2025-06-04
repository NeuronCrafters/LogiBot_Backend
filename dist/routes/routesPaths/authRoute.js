"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoute = void 0;
const express_1 = require("express");
const isPermissions_1 = require("../../middlewares/isPermissions/isPermissions");
const CreateUserController_1 = require("../../controllers/users/CreateUserController");
const DetailsUserController_1 = require("../../controllers/users/DetailsUserController");
const AuthUserController_1 = require("../../controllers/users/AuthUserController");
const LogoutUserController_1 = require("../../controllers/users/LogoutUserController");
const UpdateProfileController_1 = require("../../controllers/users/UpdateProfileController");
const authRoute = (0, express_1.Router)();
exports.authRoute = authRoute;
const createUserController = new CreateUserController_1.CreateUserController();
const updateProfileController = new UpdateProfileController_1.UpdateProfileController();
const authUserController = new AuthUserController_1.AuthUserController();
const logoutController = new LogoutUserController_1.LogoutUserController();
const detailsUserController = new DetailsUserController_1.DetailsUserController();
/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Rotas relacionadas a login detalhes da conta, logout e outros...
 */
/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Auth]
 *     summary: Criação de novo usuário
 *     description: Cadastra um novo usuário (aluno).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - school
 *               - course
 *               - class
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               school:
 *                 type: string
 *               course:
 *                 type: string
 *               class:
 *                 type: string
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       409:
 *         description: Email já está em uso
 */
authRoute.post("/users", createUserController.handle.bind(createUserController));
/**
 * @swagger
 * /profile/{userId}:
 *   put:
 *     tags: [Auth]
 *     summary: Atualizar perfil do usuário
 *     description: Atualiza nome, email ou senha do usuário.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perfil atualizado
 *       404:
 *         description: Usuário não encontrado
 */
authRoute.put("/profile/:userId", ...isPermissions_1.isPermissions.isAuthenticated(), updateProfileController.handle.bind(updateProfileController));
/**
 * @swagger
 * /session:
 *   post:
 *     tags: [Auth]
 *     summary: Login do usuário
 *     description: Autentica um usuário com email e senha.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Autenticação realizada com sucesso
 *       401:
 *         description: Credenciais inválidas
 */
authRoute.post("/session", authUserController.handle.bind(authUserController));
/**
 * @swagger
 * /logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout do usuário
 *     description: Encerra a sessão do usuário autenticado.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessão encerrada
 *       404:
 *         description: Nenhuma sessão ativa
 */
authRoute.post("/logout", ...isPermissions_1.isPermissions.isAuthenticated(), logoutController.handle.bind(logoutController));
/**
 * @swagger
 * /me:
 *   get:
 *     tags: [Auth]
 *     summary: Dados do usuário autenticado
 *     description: Retorna as informações do usuário atualmente autenticado.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dados do usuário
 *       401:
 *         description: Não autorizado
 */
authRoute.get("/me", ...isPermissions_1.isPermissions.isAuthenticated(), detailsUserController.handle.bind(detailsUserController));
