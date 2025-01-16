import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { CreateUserController } from "../../controllers/users/CreateUserController";
import { DetailsUserController } from "../../controllers/users/DetailsUserController";
import { AuthUserController } from "../../controllers/users/AuthUserController";
import { LogoutController } from "../../controllers/users/LogoutController";

const authRoute = Router();

// Rotas de Usuários
authRoute.post("/users", new CreateUserController().handle);
authRoute.post("/session", new AuthUserController().handle);
authRoute.post("/logout", isAuthenticated, new LogoutController().handle);
authRoute.get("/me", isAuthenticated, new DetailsUserController().handle);

export { authRoute };
