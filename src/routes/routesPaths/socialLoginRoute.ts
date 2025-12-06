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

                const isProduction = process.env.NODE_ENV === "production";

                // configuração de dev
                // res.cookie("token", token, {
                //     httpOnly: true,
                //     secure: isProduction,
                //     sameSite: isProduction ? "none" : "lax",
                //     maxAge: 1000 * 60 * 60 * 2,
                //     domain: isProduction ? process.env.COOKIE_DOMAIN : "localhost",
                // });

                // const redirectTo =
                //     process.env.GOOGLE_LOGIN_REDIRECT ||
                //     (isProduction
                //         ? "https://saellogibot.com/chat"
                //         : "http://localhost:5173/chat");

                // return res.redirect(redirectTo);

                // configuração de produção

                res.cookie("token", token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "none",
                    maxAge: 1000 * 60 * 60 * 2,
                    domain: process.env.COOKIE_DOMAIN,
                });

                return res.redirect(process.env.GOOGLE_LOGIN_REDIRECT || "https://saellogibot.com/chat");
            }
        )(req, res, next)
);

socialLoginRoute.get("/profile", (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ message: "Usuário não autenticado." });
    }

    res.json({ message: "Perfil do usuário autenticado", user: req.user });
});

export { socialLoginRoute };
