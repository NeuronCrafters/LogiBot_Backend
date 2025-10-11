import { Router } from "express";
import { LogoutUserController } from "../../controllers/users/LogoutUserController";

const logoutRoute = Router();
const logoutUserController = new LogoutUserController();

logoutRoute.post("/logout", logoutUserController.handle);

export { logoutRoute };