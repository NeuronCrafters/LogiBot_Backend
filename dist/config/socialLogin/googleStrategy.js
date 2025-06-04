"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.googleStrategy = void 0;
const passport_google_oauth20_1 = require("passport-google-oauth20");
const signupGoogleController_1 = require("../../controllers/google/signupGoogleController");
const signupGoogleController = new signupGoogleController_1.SignupGoogleController();
const googleStrategy = new passport_google_oauth20_1.Strategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/auth/google/callback',
}, signupGoogleController.handle.bind(signupGoogleController));
exports.googleStrategy = googleStrategy;
