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
                    maxAge: 24 * 60 * 60 * 1000,
                });

                const redirectTo = process.env.GOOGLE_LOGIN_REDIRECT || "https://saellogibot.com/chat";

                return res.redirect(redirectTo);
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
