import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateUserController } from "../../controllers/users/CreateUserController";
import { DetailsUserController } from "../../controllers/users/DetailsUserController";
import { AuthUserController } from "../../controllers/users/AuthUserController";
import { LogoutUserController } from "../../controllers/users/LogoutUserController";
import { UpdatePasswordController } from "../../controllers/users/updatePasswordController";
import { UpdateNameController } from "../../controllers/users/UpdateNameController";
import { UpdateEmailController } from "../../controllers/users/UpdateEmailController";

const authRoute = Router();

const createUserController = new CreateUserController();
const authUserController = new AuthUserController();
// const logoutController = new LogoutUserController();
const detailsUserController = new DetailsUserController();
const updatePasswordController = new UpdatePasswordController();
const updateNameController = new UpdateNameController();
const updateEmailController = new UpdateEmailController();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Rotas de autenticação, criação de usuários e gerenciamento de perfil.
 */

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Auth]
 *     summary: Criação de novo usuário
 *     description: Rota para cadastrar um novo usuário (aluno) na plataforma.
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
 *                 example: "João da Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao.silva@email.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "senhaForte123"
 *               school:
 *                 type: string
 *                 example: "Escola Estadual Mário de Andrade"
 *               course:
 *                 type: string
 *                 example: "Ensino Médio"
 *               class:
 *                 type: string
 *                 example: "3º Ano B"
 *     responses:
 *       '201':
 *         description: Usuário criado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "a1b2c3d4-e5f6-7890-1234-567890abcdef"
 *                 name:
 *                   type: string
 *                   example: "João da Silva"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "joao.silva@email.com"
 *       '409':
 *         description: O email informado já está em uso.
 */
authRoute.post("/users", createUserController.handle.bind(createUserController));

/**
 * @swagger
 * /session:
 *   post:
 *     tags: [Auth]
 *     summary: Login do usuário
 *     description: Autentica um usuário com email e senha e retorna um token de acesso.
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
 *                 format: email
 *                 example: "joao.silva@email.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "senhaForte123"
 *     responses:
 *       '200':
 *         description: Autenticação bem-sucedida.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       '401':
 *         description: Credenciais inválidas (email ou senha incorretos).
 */
authRoute.post("/session", authUserController.handle.bind(authUserController));

// /**
//  * @swagger
//  * /logout:
//  *   post:
//  *     tags: [Auth]
//  *     summary: Logout do usuário
//  *     description: Invalida o token de sessão do usuário autenticado.
//  *     security:
//  *       - bearerAuth: []
//  *     responses:
//  *       '200':
//  *         description: Sessão encerrada com sucesso.
//  *       '401':
//  *         description: Não autorizado (token inválido ou ausente).
//  */
// authRoute.post("/logout", ...isPermissions.isAuthenticated(), logoutController.handle.bind(logoutController));

/**
 * @swagger
 * /me:
 *   get:
 *     tags: [Auth]
 *     summary: Dados do usuário autenticado
 *     description: Retorna as informações detalhadas do usuário que está logado.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Sucesso ao retornar os dados do usuário.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   example: "a1b2c3d4-e5f6-7890-1234-567890abcdef"
 *                 name:
 *                   type: string
 *                   example: "João da Silva"
 *                 email:
 *                   type: string
 *                   format: email
 *                   example: "joao.silva@email.com"
 *       '401':
 *         description: Não autorizado (token inválido ou ausente).
 */
authRoute.get("/me", ...isPermissions.isAuthenticated(), detailsUserController.handle.bind(detailsUserController));

authRoute.patch("/users/password", ...isPermissions.isAuthenticated(), updatePasswordController.handle.bind(updatePasswordController));

authRoute.patch("/users/:userId/name", ...isPermissions.isAuthenticated(), updateNameController.handle.bind(updateNameController));

authRoute.patch("/users/:userId/email", ...isPermissions.isAuthenticated(), updateEmailController.handle.bind(updateEmailController));

export { authRoute };