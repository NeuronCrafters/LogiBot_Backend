import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated";
import { CreateUserController } from "../../controllers/users/CreateUserController";
import { DetailsUserController } from "../../controllers/users/DetailsUserController";
import { AuthUserController } from "../../controllers/users/AuthUserController";
import { LogoutController } from "../../controllers/users/LogoutController";
import { RasaController } from "../../controllers/rasa/rasaController";

const authRoute = Router();

// Rotas de Usuários
authRoute.post("/users", new CreateUserController().handle);
authRoute.post("/session", new AuthUserController().handle);
authRoute.post("/logout", isAuthenticated, new LogoutController().handle);
authRoute.get("/me", isAuthenticated, new DetailsUserController().handle);

// Rotas do Rasa (chat SAEL)
authRoute.get("/sael/talk", isAuthenticated, new RasaController().handle);

export { authRoute };
