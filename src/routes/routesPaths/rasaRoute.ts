import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { RasaSendController } from "../../controllers/rasa/rasaSendController";
import { listarNiveisController } from "../../controllers/rasa/ActionController/listarNiveisController";
import { definirNivelController } from "../../controllers/rasa/ActionController/definirNivelController";
import { listarOpcoesController } from "../../controllers/rasa/ActionController/listarOpcoesController";
import { sendOpcaoEListarSubopcoesController } from "../../controllers/rasa/ActionController/sendOpcaoEListarSubopcoesController";
import { gerarPerguntasController } from "../../controllers/rasa/ActionController/gerarPerguntasController";
import { getGabaritoController } from "../../controllers/rasa/ActionController/getGabaritoController";
import { verificarRespostasController } from "../../controllers/rasa/ActionController/verificarRespostasController";

const rasaRouter = Router();
const sendController = new RasaSendController();


/**
 * @swagger
 * tags:
 *   name: Rasa
 *   description: Rotas relacionadas ao chatbot Rasa
 */

/**
 * @swagger
 * /sael/talk:
 *   post:
 *     summary: Enviar mensagem para o chatbot
 *     tags: [Rasa]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       200:
 *         description: Resposta do chatbot
 */
// Rota para enviar mensagem ao chatbot (ainda em classe)
rasaRouter.post("/talk", ...isPermissions.isAuthenticated(), sendController.handle.bind(sendController));


/**
 * @swagger
 * /sael/action/listar_niveis:
 *   get:
 *     summary: Listar níveis disponíveis
 *     tags: [Rasa]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de níveis
 */
// Rota: Listar níveis
rasaRouter.get("/action/listar_niveis", ...isPermissions.isAuthenticated(), listarNiveisController);


/**
 * @swagger
 * /sael/action/definir_nivel:
 *   post:
 *     summary: Definir o nível do usuário
 *     tags: [Rasa]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nivel:
 *                 type: string
 *     responses:
 *       200:
 *         description: Nível definido com sucesso
 */
// Rota: Definir nível
rasaRouter.post("/action/definir_nivel", ...isPermissions.isAuthenticated(), definirNivelController);

/**
 * @swagger
 * /sael/action/listar_opcoes:
 *   get:
 *     summary: Listar opções disponíveis
 *     tags: [Rasa]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de opções
 */
// Rota: Listar opções
rasaRouter.get("/action/listar_opcoes", ...isPermissions.isAuthenticated(), listarOpcoesController);


/**
 * @swagger
 * /sael/action/listar_subopcoes:
 *   post:
 *     summary: Listar subopções com base na categoria
 *     tags: [Rasa]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               categoria:
 *                 type: string
 *     responses:
 *       200:
 *         description: Lista de subopções retornada com sucesso
 */
// Rota: Listar subopções
rasaRouter.post("/action/listar_subopcoes", ...isPermissions.isAuthenticated(), sendOpcaoEListarSubopcoesController);


/**
 * @swagger
 * /sael/action/gerar_perguntas:
 *   post:
 *     summary: Gerar perguntas com base no assunto
 *     tags: [Rasa]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pergunta:
 *                 type: string
 *     responses:
 *       200:
 *         description: Perguntas geradas com sucesso
 */
// Rota: Gerar perguntas
rasaRouter.post("/action/gerar_perguntas", ...isPermissions.isAuthenticated(), gerarPerguntasController);


/**
 * @swagger
 * /sael/action/gabarito:
 *   get:
 *     summary: Obter o gabarito das últimas perguntas geradas
 *     tags: [Rasa]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gabarito retornado com sucesso
 */
// Rota: Obter gabarito
rasaRouter.get("/action/gabarito", ...isPermissions.isAdminProfessorOrCoordinator(), getGabaritoController);


/**
 * @swagger
 * /sael/action/send:
 *   post:
 *     summary: Verificar respostas do usuário
 *     tags: [Rasa]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               respostas:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Resultado da verificação das respostas
 */
// Rota: Verificar respostas
rasaRouter.post("/action/send", ...isPermissions.isAuthenticated(), verificarRespostasController);

export { rasaRouter };
