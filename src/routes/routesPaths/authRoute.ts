import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated";
import { CreateUserController } from "../../controllers/users/CreateUserController";
import { DetailsUserController } from "../../controllers/users/DetailsUserController";
import { AuthUserController } from "../../controllers/users/AuthUserController";
import { LogoutController } from "../../controllers/users/LogoutController";
import { RasaController } from "../../controllers/rasa/rasaController";
import passport from "passport";

const authRoute = Router();

// Rotas de Usuários
authRoute.post("/users", new CreateUserController().handle);
authRoute.post("/session", new AuthUserController().handle); // login tradicional (email/senha)
authRoute.post("/logout", isAuthenticated, new LogoutController().handle);
authRoute.get("/me", isAuthenticated, new DetailsUserController().handle);

// Rotas do Rasa (chat SAEL)
authRoute.get("/sael/talk", isAuthenticated, new RasaController().handle);

// Rota de Login Social com Google
authRoute.get("/google", passport.authenticate("google", { scope: ["profile", "email"] }));

// Rota de Callback do Google
authRoute.get("/google/callback",
  passport.authenticate("google", { failureRedirect: "/" }),
  (req: any, res) => {
    const { token } = req.user;

    res.redirect(`/sael/talk?token=${token}`);
  }
);

export { authRoute };
