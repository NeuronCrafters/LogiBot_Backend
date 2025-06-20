import { Router } from "express";
import { passport } from "../../config/socialLogin/passport";

const socialLoginRoute = Router();

/* ---------- LOGIN (Google) ---------- */
socialLoginRoute.get(
    "/auth/google/login",
    passport.authenticate("google-login", { scope: ["profile", "email"] })
);

/* ---------- CALLBACK ---------- */
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

                /* ✅ Define cookie seguro com JWT */
                res.cookie("token", token, {
                    httpOnly: true,
                    secure: true,          // ✔️ ok, porque seu NGINX está em HTTPS
                    sameSite: "none",      // ✔️ necessário quando frontend e backend têm domínios diferentes
                    maxAge: 24 * 60 * 60 * 1000, // 1 dia
                });

                /* ✅ Redirecionamento após login */
                const redirectTo =
                    (req.query.redirect as string | undefined) ||
                    process.env.GOOGLE_LOGIN_REDIRECT ||
                    "https://seu-frontend.com/painel"; // fallback seguro

                return res.redirect(redirectTo);
            }
        )(req, res, next)
);

/* ---------- PROFILE (debug opcional) ---------- */
socialLoginRoute.get("/profile", (req, res) => {
    if (!req.isAuthenticated?.() || !req.user) {
        return res.status(401).json({ message: "Usuário não autenticado." });
    }

    res.json({ message: "Perfil do usuário autenticado", user: req.user });
});

export { socialLoginRoute };
