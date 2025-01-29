import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateUserController } from "../../controllers/users/CreateUserController";
import { DetailsUserController } from "../../controllers/users/DetailsUserController";
import { AuthUserController } from "../../controllers/users/AuthUserController";
import { LogoutController } from "../../controllers/users/LogoutController";

const authRoute = Router();

// Rota para criar conta
authRoute.post("/users", new CreateUserController().handle);

// Rota para logar
authRoute.post("/session", new AuthUserController().handle);

// Rota de logout (somente usuários autenticados)
authRoute.post("/logout", ...isPermissions.isAuthenticated(), new LogoutController().handle);

// Rota para ver detalhes da própria conta (somente usuários autenticados)
authRoute.get("/me", ...isPermissions.isAuthenticated(), new DetailsUserController().handle);

export { authRoute };
