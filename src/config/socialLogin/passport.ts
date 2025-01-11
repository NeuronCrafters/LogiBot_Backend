import passport from 'passport';
import { googleStrategy } from './googleStrategy';
import { User } from '../../models/User';

passport.use(googleStrategy);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error);
  }
});
