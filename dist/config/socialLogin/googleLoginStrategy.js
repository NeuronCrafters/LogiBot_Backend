"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleLoginStrategy = void 0;
const passport_google_oauth20_1 = require("passport-google-oauth20");
const signinGoogleController_1 = require("../../controllers/google/signinGoogleController");
const googleSigninController = new signinGoogleController_1.SigninGoogleController();
const googleLoginStrategy = new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/login-callback',
}, googleSigninController.handle.bind(googleSigninController));
exports.googleLoginStrategy = googleLoginStrategy;
