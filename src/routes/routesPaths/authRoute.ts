import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated/isAuthenticated";
import { CreateUserController } from "../../controllers/users/CreateUserController";
import { DetailsUserController } from "../../controllers/users/DetailsUserController";
import { AuthUserController } from "../../controllers/users/AuthUserController";
import { LogoutController } from "../../controllers/users/LogoutController";

const authRoute = Router();

// rota para criar conta
authRoute.post("/users", new CreateUserController().handle);

// rota para logar
authRoute.post("/session", new AuthUserController().handle);

//rota de logout
authRoute.post("/logout", isAuthenticated, new LogoutController().handle);

// rota para ver detales da própria conta
authRoute.get("/me", isAuthenticated, new DetailsUserController().handle);

export { authRoute };
