import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateUserController } from "../../controllers/users/CreateUserController";
import { DetailsUserController } from "../../controllers/users/DetailsUserController";
import { AuthUserController } from "../../controllers/users/AuthUserController";
import { LogoutUserController } from "../../controllers/users/LogoutUserController";
import { UpdateProfileController } from "../../controllers/users/UpdateProfileController";

const authRoute = Router();

const createUserController = new CreateUserController();
const updateProfileController = new UpdateProfileController();
const authUserController = new AuthUserController();
const logoutController = new LogoutUserController();
const detailsUserController = new DetailsUserController();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: Rotas de autenticação, criação de usuários e gerenciamento de perfil.
 */

// ---------------------- ROTAS PÚBLICAS ----------------------

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

// ---------------------- ROTAS PROTEGIDAS ----------------------

/**
 * @swagger
 * /profile/{userId}:
 *   put:
 *     tags: [Auth]
 *     summary: Atualizar perfil do usuário
 *     description: Permite que um usuário autenticado atualize seu próprio nome, email ou senha.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         description: ID do usuário a ser atualizado.
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
 *                 example: "João da Silva Santos"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao.santos@email.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "novaSenhaSuperForte456"
 *     responses:
 *       '200':
 *         description: Perfil atualizado com sucesso.
 *       '401':
 *         description: Não autorizado (token inválido ou ausente).
 *       '404':
 *         description: Usuário não encontrado.
 */
authRoute.put("/profile/:userId", ...isPermissions.isAuthenticated(), updateProfileController.handle.bind(updateProfileController));

/**
 * @swagger
 * /logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout do usuário
 *     description: Invalida o token de sessão do usuário autenticado.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Sessão encerrada com sucesso.
 *       '401':
 *         description: Não autorizado (token inválido ou ausente).
 */
authRoute.post("/logout", ...isPermissions.isAuthenticated(), logoutController.handle.bind(logoutController));

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

export { authRoute };