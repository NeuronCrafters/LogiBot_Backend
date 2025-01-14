import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '../../models/User';
import { allowedDomains } from './allowedDomains';

const googleStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: '/auth/google/callback',
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const emailDomain = email?.split('@')[1];

      if (!email || !allowedDomains.includes(emailDomain!)) {
        return done(null, false, { message: 'Domínio do email não permitido.' });
      }

      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email,
          photo: profile.photos?.[0]?.value || null,
        });
      }

      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
);


export { googleStrategy }