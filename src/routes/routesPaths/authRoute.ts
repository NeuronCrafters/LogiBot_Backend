import { Router } from "express";
import { isAuthenticated } from "../../middlewares/isAuthenticated";
import { CreateUserController } from "../../controllers/users/CreateUserController";
import { DetailsUserController } from "../../controllers/users/DetailsUserController";
import { AuthUserController } from "../../controllers/users/AuthUserController";
import { LogoutController } from "../../controllers/users/LogoutController";
import { RasaController } from "../../controllers/rasa/rasaController";
import { passport } from '../../config/socialLogin/passport';

const authRoute = Router();

// Rotas de Usuários
authRoute.post("/users", new CreateUserController().handle);
authRoute.post("/session", new AuthUserController().handle);
authRoute.post("/logout", isAuthenticated, new LogoutController().handle);
authRoute.get("/me", isAuthenticated, new DetailsUserController().handle);

// Rotas do Rasa (chat SAEL)
authRoute.get("/sael/talk", isAuthenticated, new RasaController().handle);



// Rotas de Autenticação com Google
authRoute.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

authRoute.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/profile');
  }
);


// Perfil do Usuário (Proteger rota para testar login social)
authRoute.get("/profile", isAuthenticated, (req, res) => {
  res.json({
    message: "Perfil do usuário autenticado",
    user: req.user,
  });
});



export { authRoute };
