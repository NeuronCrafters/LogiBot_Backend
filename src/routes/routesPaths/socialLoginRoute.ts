import { Router } from "express";
import { passport } from "../../config/socialLogin/passport";

const socialLoginRoute = Router();

socialLoginRoute.get(
    "/auth/google/login",
    passport.authenticate("google-login", { scope: ["profile", "email"] })
);

socialLoginRoute.get(
    "/auth/google/login-callback",
    (req, res, next) =>
        passport.authenticate(
            "google-login",
            { session: false },
            (err, data, info) => {
                if (err) return next(err);
                if (!data) {
                    return res.status(404).json({
                        success: false,
                        message: info?.message || "Usuário não encontrado.",
                    });
                }

                const { user, token } = data as any;

                res.cookie("token", token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "none",
                    maxAge: 1000 * 60 * 60 * 2,
                    domain: ".saellogibot.com",
                    path: "/"
                });

                return res.redirect("https://saellogibot.com/chat");
            }
        )(req, res, next)
);

export { socialLoginRoute };