"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rasaRouter = void 0;
const express_1 = require("express");
const isPermissions_1 = require("../../middlewares/isPermissions/isPermissions");
const rasaSendController_1 = require("../../controllers/rasa/rasaSendController");
const listarNiveisController_1 = require("../../controllers/rasa/ActionController/listarNiveisController");
const definirNivelController_1 = require("../../controllers/rasa/ActionController/definirNivelController");
const listarOpcoesController_1 = require("../../controllers/rasa/ActionController/listarOpcoesController");
const sendOpcaoEListarSubopcoesController_1 = require("../../controllers/rasa/ActionController/sendOpcaoEListarSubopcoesController");
const gerarPerguntasController_1 = require("../../controllers/rasa/ActionController/gerarPerguntasController");
const getGabaritoController_1 = require("../../controllers/rasa/ActionController/getGabaritoController");
const verificarRespostasController_1 = require("../../controllers/rasa/ActionController/verificarRespostasController");
const inicioController_1 = require("../../controllers/rasa/ActionChat/inicioController");
const conversarController_1 = require("../../controllers/rasa/ActionChat/conversarController");
const perguntarController_1 = require("../../controllers/rasa/ActionChat/perguntarController");
const rasaRouter = (0, express_1.Router)();
exports.rasaRouter = rasaRouter;
const sendController = new rasaSendController_1.RasaSendController();
/**
 * @swagger
 * tags:
 *   name: Rasa
 *   description: Rotas relacionadas ao SAEL
 */
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
rasaRouter.get("/action/inicio", ...isPermissions_1.isPermissions.isAuthenticated(), inicioController_1.inicioController);
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
rasaRouter.post("/action/conversar", ...isPermissions_1.isPermissions.isAuthenticated(), conversarController_1.conversarController);
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
rasaRouter.post("/action/perguntar", ...isPermissions_1.isPermissions.isAuthenticated(), perguntarController_1.actionPerguntarController);
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
rasaRouter.get("/action/listar_niveis", ...isPermissions_1.isPermissions.isAuthenticated(), listarNiveisController_1.listarNiveisController);
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
rasaRouter.post("/action/definir_nivel", ...isPermissions_1.isPermissions.isAuthenticated(), definirNivelController_1.definirNivelController);
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
rasaRouter.get("/action/listar_opcoes", ...isPermissions_1.isPermissions.isAuthenticated(), listarOpcoesController_1.listarOpcoesController);
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
rasaRouter.post("/action/listar_subopcoes", ...isPermissions_1.isPermissions.isAuthenticated(), sendOpcaoEListarSubopcoesController_1.sendOpcaoEListarSubopcoesController);
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
rasaRouter.post("/action/gerar_perguntas", ...isPermissions_1.isPermissions.isAuthenticated(), gerarPerguntasController_1.gerarPerguntasController);
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
rasaRouter.post("/action/send", ...isPermissions_1.isPermissions.isAuthenticated(), verificarRespostasController_1.verificarRespostasController);
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
rasaRouter.get("/action/gabarito", ...isPermissions_1.isPermissions.isAdminProfessorOrCoordinator(), getGabaritoController_1.getGabaritoController);
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
rasaRouter.post("/talk", ...isPermissions_1.isPermissions.isAuthenticated(), sendController.handle.bind(sendController));
