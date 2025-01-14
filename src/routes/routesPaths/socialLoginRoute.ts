import { Router } from 'express';
import { passport } from '../../config/socialLogin/passport';

const socialLoginRoute = Router();

// Rota de login com Google
socialLoginRoute.get(
  '/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Callback do Google
socialLoginRoute.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false }),
  (req, res) => {
    const { user, token } = req.user as any; // Obtenha o usuário e o token
    return res.json({
      message: 'Autenticação com Google realizada com sucesso!',
      user,
      token,
    });
  }
);

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

export { socialLoginRoute };
