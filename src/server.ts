import "express-async-errors";
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "./config/socialLogin/passport";
import { connectDB } from "./config/database";
import { setupSwagger } from "./config/swagger/swaggerConfig";
import { routes } from "./routes/routes";
import { authRoutes } from "./routes/routesPaths/socialLoginRoute";
import { errorHandler } from "./middlewares/errorHandler/errorHandler";
import { corsErrorHandler } from "./middlewares/corsErrorHandler/corsErrorHandler";
import { corsAccessLogger } from "./middlewares/corsErrorHandler/corsAccessLogger";
import { initAdminUser } from "./config/initAdminUser/initAdminUser";

const app = express();

async function initializeApp() {
    try {
        console.log("tentando conectar ao mongodb...");
        await connectDB();
        console.log("conexão com mongodb bem-sucedida.");

        await initAdminUser();
        console.log("verificação do usuário admin concluída.");

    } catch (error) {
        console.error("erro crítico na inicialização. o processo será encerrado:");
        console.error(error);
        process.exit(1);
    }

    const requiredEnvVars = ["FRONT_URL", "MONGO_URI", "JWT_SECRET"];

    const hasGoogleConfig = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

    if (hasGoogleConfig && !process.env.SESSION_SECRET) {
        console.error("erro: session_secret necessário quando google oauth está configurado");
        process.exit(1);
    }

    for (const varName of requiredEnvVars) {
        if (!process.env[varName]) {
            console.error(`erro: variável de ambiente necessária ausente: ${varName}`);
            process.exit(1);
        }
    }
    console.log("variáveis de ambiente essenciais verificadas.");

    const allowedOrigins = [
        "https://logibotsai.neuroncrafters.dev",
        "https://saellogibot.com",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3001",
        process.env.FRONT_URL
    ].filter(Boolean);

    app.use(cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                console.log("origem bloqueada por cors:", origin);
                callback(new Error("not allowed by cors"));
            }
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allowedHeaders: [
            "Content-Type",
            "Authorization",
            "Cookie",
            "X-Requested-With",
            "x-api-key",
            "X-API-Key"
        ],
        exposedHeaders: ["Set-Cookie"],
        maxAge: 86400
    }));

    app.use(corsAccessLogger);
    app.use(cookieParser());
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    if (hasGoogleConfig) {
        app.use(session({
            secret: process.env.SESSION_SECRET!,
            resave: false,
            saveUninitialized: false,
            cookie: {
                secure: false,
                httpOnly: true,
                maxAge: 1000 * 60 * 60 * 2
            }
        }));

        app.use(passport.initialize());
        app.use(passport.session());

        app.use("/auth", authRoutes);
        console.log("google oauth configurado e rotas /auth habilitadas");
    } else {
        console.log("google oauth não configurado - rotas /auth desabilitadas");
    }

    app.use(routes);

    setupSwagger(app);

    app.use(corsErrorHandler);
    app.use(errorHandler);

    process.on("unhandledRejection", (reason) => { console.error("unhandled rejection:", reason); });
    process.on("uncaughtException", (error) => { console.error("uncaught exception:", error); });

    const port = parseInt(process.env.PORT || "3000", 10);

    console.log(`servidor express pronto para ouvir na porta ${port}...`);

    app.listen(port, "0.0.0.0", () => {
        console.log(`servidor express rodando em http://localhost:${port}`);
    });
}

initializeApp();