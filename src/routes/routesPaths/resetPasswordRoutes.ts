import { Router } from "express";
import { ResetPasswordController } from "../../controllers/password/resetPasswordController";
import { UpdatePasswordController } from "../../controllers/password/updatePasswordController";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";

const passwordRouter = Router();

passwordRouter.patch("/reset-password", new ResetPasswordController().handle);
passwordRouter.patch("/update-password", isAuthenticated, new UpdatePasswordController().handle);


export { passwordRouter };
