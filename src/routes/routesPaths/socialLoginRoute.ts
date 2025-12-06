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

                const { token } = data as any;

                res.cookie("token", token, {
                    httpOnly: true,
                    secure: true,
                    sameSite: "strict",
                    maxAge: 1000 * 60 * 60 * 2,
                    domain: ".saellogibot.com",
                    path: "/"
                });

                const htmlRedirect = `
                <html>
                    <head>
                        <meta charset="UTF-8" />
                        <title>Autenticando...</title>
                        <script>
                            window.location.href = "https://saellogibot.com/chat";
                        </script>
                    </head>
                    <body style="background-color: #121212; color: #ffffff; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
                        <div style="text-align: center;">
                            <h3>Login realizado com sucesso!</h3>
                            <p>Redirecionando para o chat...</p>
                        </div>
                    </body>
                </html>
                `;

                return res.send(htmlRedirect);
            }
        )(req, res, next)
);

export { socialLoginRoute };