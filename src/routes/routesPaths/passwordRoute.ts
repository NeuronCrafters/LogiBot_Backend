import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { SendResetPasswordEmailController } from "../../controllers/password/sendResetPasswordEmailController";
import { ResetPasswordController } from "../../controllers/password/resetPasswordController";

const passwordRouter = Router();

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
passwordRouter.post("/send-reset-password", new SendResetPasswordEmailController().handle);


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
passwordRouter.patch("/reset-password", new ResetPasswordController().handle);

export { passwordRouter };
