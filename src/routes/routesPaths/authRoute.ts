import { Router } from "express";
import { isPermissions } from "../../middlewares/isPermissions/isPermissions";
import { CreateUserController } from "../../controllers/users/CreateUserController";
import { DetailsUserController } from "../../controllers/users/DetailsUserController";
import { AuthUserController } from "../../controllers/users/AuthUserController";
import { LogoutUserController } from "../../controllers/users/LogoutUserController";
import { UpdateProfileController } from "../../controllers/users/UpdateProfileController";

const authRoute = Router();

// Criando instâncias dos controllers
const createUserController = new CreateUserController();
const updateProfileController = new UpdateProfileController();
const authUserController = new AuthUserController();
const logoutController = new LogoutUserController();
const detailsUserController = new DetailsUserController();

// Rota para criar conta (cadastro)
authRoute.post("/users", createUserController.handle.bind(createUserController));

// Rota para atualizar perfil do usuário (somente autenticado)
authRoute.put("/profile/:userId", ...isPermissions.isAuthenticated(), updateProfileController.handle.bind(updateProfileController));

// Rota para login (autenticação)
authRoute.post("/session", authUserController.handle.bind(authUserController));

// Rota para logout (encerra a sessão, somente autenticado)
authRoute.post("/logout", ...isPermissions.isAuthenticated(), logoutController.handle.bind(logoutController));

// Rota para ver detalhes da conta (somente autenticado)
authRoute.get("/me", ...isPermissions.isAuthenticated(), detailsUserController.handle.bind(detailsUserController));

export { authRoute };
