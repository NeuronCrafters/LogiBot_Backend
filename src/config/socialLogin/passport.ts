import passport from 'passport';
import { googleStrategy } from './googleStrategy';
import { googleLoginStrategy } from './googleLoginStrategy';
import { User } from '../../models/User';

// Loga um usuário no sistema Google
passport.use('google-login', googleLoginStrategy);

// Registra um usuário no sistema via Google
passport.use('google-signup', googleStrategy);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    if (!user) {
      return done(new Error('Usuário não encontrado durante a deserialização.'), null);
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export { passport };
