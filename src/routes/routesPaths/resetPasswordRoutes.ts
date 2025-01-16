import { Router } from "express";
import { SendResetPasswordEmailController } from "../../controllers/password/sendResetPasswordEmailController";
import { ResetPasswordController } from "../../controllers/password/resetPasswordController";
import { GenerateResetTokenController } from "../../controllers/password/generateResetTokenController";

const passwordRouter = Router();

passwordRouter.post("/send-reset-password", new SendResetPasswordEmailController().handle);

passwordRouter.post("/reset-password", new ResetPasswordController().handle);

passwordRouter.post("/generate-reset-token", new GenerateResetTokenController().handle);

export { passwordRouter };
