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
 * name: Auth
 * description: Rotas relacionadas a login, detalhes da conta, logout e outros...
 */

// ---------------------- ROTAS PÚBLICAS ----------------------
// Essas rotas não precisam de autenticação, o que resolve o problema do Firefox.

/**
 * @swagger
 * /users:
 * post:
 * tags: [Auth]
 * summary: Criação de novo usuário
 * description: Cadastra um novo usuário (aluno).
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - name
 * - email
 * - password
 * - school
 * - course
 * - class
 * properties:
 * name:
 * type: string
 * email:
 * type: string
 * password:
 * type: string
 * school:
 * type: string
 * course:
 * type: string
 * class:
 * type: string
 * responses:
 * 201:
 * description: Usuário criado com sucesso
 * 409:
 * description: Email já está em uso
 */
authRoute.post("/users", createUserController.handle.bind(createUserController));

/**
 * @swagger
 * /session:
 * post:
 * tags: [Auth]
 * summary: Login do usuário
 * description: Autentica um usuário com email e senha.
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * required:
 * - email
 * - password
 * properties:
 * email:
 * type: string
 * password:
 * type: string
 * responses:
 * 200:
 * description: Autenticação realizada com sucesso
 * 401:
 * description: Credenciais inválidas
 */
authRoute.post("/session", authUserController.handle.bind(authUserController));

// ---------------------- ROTAS PROTEGIDAS ----------------------
// Essas rotas usam o middleware de permissões para garantir autenticação e autorização.

/**
 * @swagger
 * /profile/{userId}:
 * put:
 * tags: [Auth]
 * summary: Atualizar perfil do usuário
 * description: Atualiza nome, email ou senha do usuário.
 * security:
 * - bearerAuth: []
 * parameters:
 * - name: userId
 * in: path
 * required: true
 * schema:
 * type: string
 * requestBody:
 * required: true
 * content:
 * application/json:
 * schema:
 * type: object
 * properties:
 * name:
 * type: string
 * email:
 * type: string
 * password:
 * type: string
 * responses:
 * 200:
 * description: Perfil atualizado
 * 404:
 * description: Usuário não encontrado
 */
authRoute.put("/profile/:userId", ...isPermissions.isAuthenticated(), updateProfileController.handle.bind(updateProfileController));

/**
 * @swagger
 * /logout:
 * post:
 * tags: [Auth]
 * summary: Logout do usuário
 * description: Encerra a sessão do usuário autenticado.
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Sessão encerrada
 * 404:
 * description: Nenhuma sessão ativa
 */
authRoute.post("/logout", ...isPermissions.isAuthenticated(), logoutController.handle.bind(logoutController));

/**
 * @swagger
 * /me:
 * get:
 * tags: [Auth]
 * summary: Dados do usuário autenticado
 * description: Retorna as informações do usuário atualmente autenticado.
 * security:
 * - bearerAuth: []
 * responses:
 * 200:
 * description: Dados do usuário
 * 401:
 * description: Não autorizado
 */
authRoute.get("/me", ...isPermissions.isAuthenticated(), detailsUserController.handle.bind(detailsUserController));

export { authRoute };