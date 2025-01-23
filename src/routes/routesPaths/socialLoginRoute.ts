import { Router } from 'express';
import { passport } from '../../config/socialLogin/passport';

const socialLoginRoute = Router();

// Rota para login com Google 
socialLoginRoute.get(
  '/auth/google/login',
  passport.authenticate('google-login', { scope: ['profile', 'email'] })
);

// Callback do Google para login
socialLoginRoute.get(
  '/auth/google/login-callback',
  passport.authenticate('google-login', { session: false }),
  (req, res) => {
    const { user, token } = req.user as any;
    return res.json({
      message: 'Login com Google realizado com sucesso!',
      user,
      token,
    });
  }
);

// Rota para cadastro novos usuários com o Google
socialLoginRoute.get(
  '/auth/google/signup',
  passport.authenticate('google-signup', { scope: ['profile', 'email'] })
);

// Callback do Google para cadastro
socialLoginRoute.get(
  '/auth/google/callback',
  passport.authenticate('google-signup', { session: false }),
  (req, res) => {
    const { user, token } = req.user as any;
    return res.json({
      message: 'Cadastro com Google realizado com sucesso!',
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
