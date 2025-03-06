import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { SendResetPasswordEmailController } from "../../controllers/password/sendResetPasswordEmailController";
import { ResetPasswordController } from "../../controllers/password/resetPasswordController";
import { UpdatePasswordController } from "../../controllers/password/updatePasswordController";

const passwordRouter = Router();

// Rota para enviar o e-mail de redefinição
passwordRouter.post("/send-reset-password", new SendResetPasswordEmailController().handle);

// Rota para redefinir a senha
passwordRouter.patch("/reset-password", new ResetPasswordController().handle);

// Rota para atualizar a senha (somente usuários autenticados)
passwordRouter.patch("/update-password", ...isPermissions.isAuthenticated(), new UpdatePasswordController().handle);

export { passwordRouter };
