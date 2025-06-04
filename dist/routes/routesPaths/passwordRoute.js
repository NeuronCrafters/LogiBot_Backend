"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordRouter = void 0;
const express_1 = require("express");
const isPermissions_1 = require("../../middlewares/isPermissions/isPermissions");
const sendResetPasswordEmailController_1 = require("../../controllers/password/sendResetPasswordEmailController");
const resetPasswordController_1 = require("../../controllers/password/resetPasswordController");
const updatePasswordController_1 = require("../../controllers/password/updatePasswordController");
const passwordRouter = (0, express_1.Router)();
exports.passwordRouter = passwordRouter;
/**
 * @swagger
 * tags:
 *   - name: Senha
 *     description: Rotas para recuperação e atualização de senha
 */
/**
 * @swagger
 * /password/send-reset-password:
 *   post:
 *     tags: [Senha]
 *     summary: Enviar e-mail de redefinição de senha
 *     description: Envia um e-mail com link para redefinir a senha do usuário.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: E-mail de redefinição enviado com sucesso
 *       400:
 *         description: Requisição inválida
 */
// Rota para enviar o e-mail de redefinição
passwordRouter.post("/send-reset-password", new sendResetPasswordEmailController_1.SendResetPasswordEmailController().handle);
/**
 * @swagger
 * /password/reset-password:
 *   patch:
 *     tags: [Senha]
 *     summary: Redefinir senha
 *     description: Permite redefinir a senha com base no token recebido por e-mail.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - newPassword
 *             properties:
 *               token:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Senha redefinida com sucesso
 *       400:
 *         description: Token inválido ou expirado
 */
// Rota para redefinir a senha
passwordRouter.patch("/reset-password", new resetPasswordController_1.ResetPasswordController().handle);
/**
 * @swagger
 * /password/update-password:
 *   patch:
 *     tags: [Senha]
 *     summary: Atualizar senha
 *     description: Permite que usuários autenticados atualizem sua senha.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Senha atualizada com sucesso
 *       400:
 *         description: Senha atual incorreta
 */
// Rota para atualizar a senha (somente usuários autenticados)
passwordRouter.patch("/update-password", ...isPermissions_1.isPermissions.isAuthenticated(), new updatePasswordController_1.UpdatePasswordController().handle);
