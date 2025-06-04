"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.socialLoginRoute = void 0;
const express_1 = require("express");
const passport_1 = require("../../config/socialLogin/passport");
const socialLoginRoute = (0, express_1.Router)();
exports.socialLoginRoute = socialLoginRoute;
// Rota para login com Google 
socialLoginRoute.get('/auth/google/login', passport_1.passport.authenticate('google-login', { scope: ['profile', 'email'] }));
// Callback do Google para login
socialLoginRoute.get('/auth/google/login-callback', passport_1.passport.authenticate('google-login', { session: false }), (req, res) => {
    const { user, token } = req.user;
    return res.json({
        message: 'Login com Google realizado com sucesso!',
        user,
        token,
    });
});
// Rota para cadastro novos usuários com o Google
socialLoginRoute.get('/auth/google/signup', passport_1.passport.authenticate('google-signup', { scope: ['profile', 'email'] }));
// Callback do Google para cadastro
socialLoginRoute.get('/auth/google/callback', passport_1.passport.authenticate('google-signup', { session: false }), (req, res) => {
    const { user, token } = req.user;
    return res.json({
        message: 'Cadastro com Google realizado com sucesso!',
        user,
        token,
    });
});
// Rota para verificar perfil do usuário autenticado
socialLoginRoute.get('/profile', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Usuário não autenticado.' });
    }
    res.json({
        message: 'Perfil do usuário autenticado',
        user: req.user,
    });
});
