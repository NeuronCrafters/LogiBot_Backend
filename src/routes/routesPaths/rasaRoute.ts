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
import { inicioController } from "../../controllers/rasa/ActionChat/inicioController";
import { conversarController } from "../../controllers/rasa/ActionChat/conversarController";
import { actionPerguntarController } from "../../controllers/rasa/ActionChat/perguntarController";

const rasaRouter = Router();
const sendController = new RasaSendController();

/**
 * @swagger
 * /sael/action/inicio:
 *   get:
 *     summary: Inicia o bot com os botões de caminho (quiz ou conversa)
 *     tags: [Caminho]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Botões retornados com sucesso
 */
rasaRouter.get("/action/inicio", ...isPermissions.isAuthenticated(), inicioController);

/**
 * @swagger
 * /sael/action/conversar:
 *   post:
 *     summary: Informa ao bot que o usuário escolheu conversar
 *     tags: [Caminho]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bot pronto para conversar
 */
rasaRouter.post("/action/conversar", ...isPermissions.isAuthenticated(), conversarController);

/**
 * @swagger
 * /sael/action/perguntar:
 *   post:
 *     summary: Enviar pergunta para a IA sobre lógica computacional
 *     tags: [Conversa]
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
 *         description: Resposta da IA sobre lógica
 */
rasaRouter.post("/action/perguntar", ...isPermissions.isAuthenticated(), actionPerguntarController);

/**
 * @swagger
 * /sael/action/listar_niveis:
 *   get:
 *     summary: Lista os níveis disponíveis para o quiz
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Níveis listados com sucesso
 */
rasaRouter.get("/action/listar_niveis", ...isPermissions.isAuthenticated(), listarNiveisController);

/**
 * @swagger
 * /sael/action/definir_nivel:
 *   post:
 *     summary: Define o nível escolhido pelo usuário
 *     tags: [Quiz]
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
rasaRouter.post("/action/definir_nivel", ...isPermissions.isAuthenticated(), definirNivelController);

/**
 * @swagger
 * /sael/action/listar_opcoes:
 *   get:
 *     summary: Lista as categorias disponíveis após definir nível
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categorias listadas com sucesso
 */
rasaRouter.get("/action/listar_opcoes", ...isPermissions.isAuthenticated(), listarOpcoesController);

/**
 * @swagger
 * /sael/action/listar_subopcoes:
 *   post:
 *     summary: Lista os subassuntos da categoria escolhida
 *     tags: [Quiz]
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
 *         description: Subopções listadas com sucesso
 */
rasaRouter.post("/action/listar_subopcoes", ...isPermissions.isAuthenticated(), sendOpcaoEListarSubopcoesController);

/**
 * @swagger
 * /sael/action/gerar_perguntas:
 *   post:
 *     summary: Gera perguntas com base no subassunto
 *     tags: [Quiz]
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
rasaRouter.post("/action/gerar_perguntas", ...isPermissions.isAuthenticated(), gerarPerguntasController);

/**
 * @swagger
 * /sael/action/send:
 *   post:
 *     summary: Envia as respostas do usuário para validação
 *     tags: [Quiz]
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
rasaRouter.post("/action/send", ...isPermissions.isAuthenticated(), verificarRespostasController);

/**
 * @swagger
 * /sael/action/gabarito:
 *   get:
 *     summary: Retorna o gabarito das últimas perguntas
 *     tags: [Quiz]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Gabarito retornado com sucesso
 */
rasaRouter.get("/action/gabarito", ...isPermissions.isAdminProfessorOrCoordinator(), getGabaritoController);

/**
 * @swagger
 * /sael/talk:
 *   post:
 *     summary: Enviar mensagem genérica para o bot (sem lógica de action)
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
 *         description: Resposta do bot
 */
rasaRouter.post("/talk", ...isPermissions.isAuthenticated(), sendController.handle.bind(sendController));

export { rasaRouter };
