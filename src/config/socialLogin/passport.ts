import passport from 'passport';
import { googleLoginStrategy } from './googleLoginStrategy';
import { User } from '../../models/User';
import { Professor } from '../../models/Professor';

passport.use('google-login', googleLoginStrategy);

passport.serializeUser((data: any, done) => {
  const userId = data?.user?.id || data?.id;
  done(null, userId);
});

passport.deserializeUser(async (id, done) => {
  try {
    let user = await User.findById(id) || await Professor.findById(id);
    if (!user) {
      return done(new Error('Usuário não encontrado durante a deserialização.'), null);
    }
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export { passport };
