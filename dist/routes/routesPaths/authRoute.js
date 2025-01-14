"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoute = void 0;
const express_1 = require("express");
const isAuthenticated_1 = require("../../middlewares/isAuthenticated");
const CreateUserController_1 = require("../../controllers/users/CreateUserController");
const DetailsUserController_1 = require("../../controllers/users/DetailsUserController");
const AuthUserController_1 = require("../../controllers/users/AuthUserController");
const LogoutController_1 = require("../../controllers/users/LogoutController");
const rasaController_1 = require("../../controllers/rasa/rasaController");
const passport_1 = require("../../config/socialLogin/passport");
const authRoute = (0, express_1.Router)();
exports.authRoute = authRoute;
// Rotas de Usuários
authRoute.post("/users", new CreateUserController_1.CreateUserController().handle);
authRoute.post("/session", new AuthUserController_1.AuthUserController().handle);
authRoute.post("/logout", isAuthenticated_1.isAuthenticated, new LogoutController_1.LogoutController().handle);
authRoute.get("/me", isAuthenticated_1.isAuthenticated, new DetailsUserController_1.DetailsUserController().handle);
// Rotas do Rasa (chat SAEL)
authRoute.get("/sael/talk", isAuthenticated_1.isAuthenticated, new rasaController_1.RasaController().handle);
// Rotas de Autenticação com Google
authRoute.get('/auth/google', passport_1.passport.authenticate('google', { scope: ['profile', 'email'] }));
authRoute.get('/auth/google/callback', passport_1.passport.authenticate('google', { failureRedirect: '/' }), (req, res) => {
    res.redirect('/profile');
});
// Perfil do Usuário (Proteger rota para testar login social)
authRoute.get("/profile", isAuthenticated_1.isAuthenticated, (req, res) => {
    res.json({
        message: "Perfil do usuário autenticado",
        user: req.user,
    });
});
