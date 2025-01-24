import { Router } from "express";
import { SendResetPasswordEmailController } from "../../controllers/password/sendResetPasswordEmailController";
import { ResetPasswordController } from "../../controllers/password/resetPasswordController";
import { UpdatePasswordController } from "../../controllers/password/updatePasswordController";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";

const passwordRouter = Router();

// Rota para enviar o e-mail de redefinição
passwordRouter.post("/send-reset-password", new SendResetPasswordEmailController().handle);

// Rota para redefinir a senha
passwordRouter.patch("/reset-password", new ResetPasswordController().handle);

// Rota para atualizar a senha 
passwordRouter.patch("/update-password", isAuthenticated, new UpdatePasswordController().handle);

export { passwordRouter };
