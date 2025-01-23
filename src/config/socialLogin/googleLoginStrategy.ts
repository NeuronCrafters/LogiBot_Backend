import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { SigninGoogleController } from '../../controllers/google/signinGoogleController';

const googleSigninController = new SigninGoogleController();

const googleLoginStrategy = new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: 'http://localhost:3000/auth/google/login-callback',
  },
  googleSigninController.handle.bind(googleSigninController)
);

export { googleLoginStrategy };
