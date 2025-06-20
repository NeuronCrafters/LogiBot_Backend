import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { SigninGoogleController } from '../../controllers/google/signinGoogleController';

const googleSigninController = new SigninGoogleController();

const googleLoginStrategy = new GoogleStrategy(
    {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_LOGIN_CALLBACK_URL!,
    },
    googleSigninController.handle.bind(googleSigninController)
);

export { googleLoginStrategy };
