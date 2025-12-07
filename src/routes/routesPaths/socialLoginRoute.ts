import { Router } from "express";
import passport from "../../config/socialLogin/passport";
import { GoogleAuthController } from "../../controllers/google/signinGoogleController";

const authRoutes = Router();
const googleAuthController = new GoogleAuthController();

authRoutes.get(
    "/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
    })
);

authRoutes.get(
    "/google/callback",
    passport.authenticate("google", {
        failureRedirect: "https://saellogibot.com?error=auth_failed",
        session: false
    }),
    googleAuthController.callback.bind(googleAuthController)
);

export { authRoutes };