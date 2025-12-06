import "express-async-errors";
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import { connectDB } from "./config/database";
import { setupSwagger } from "./config/swagger/swaggerConfig";
import "./config/socialLogin/passport";
import { routes } from "./routes/routes";
import { errorHandler } from "./middlewares/errorHandler/errorHandler";
import { corsErrorHandler } from "./middlewares/corsErrorHandler/corsErrorHandler";
import { corsAccessLogger } from "./middlewares/corsErrorHandler/corsAccessLogger";
import { initAdminUser } from "./config/initAdminUser/initAdminUser";

const app = express();

app.set("trust proxy", 1);

async function initializeApp() {
    try {
        await connectDB();
        await initAdminUser();
    } catch (err) {
        console.error("Erro ao conectar DB ou iniciar admin:", err);
        process.exit(1);
    }

    const requiredEnvVars = ["FRONT_URL", "MONGO_URI", "JWT_SECRET"];
    for (const varName of requiredEnvVars) {
        if (!process.env[varName]) {
            console.error(`Variável de ambiente ausente: ${varName}`);
            process.exit(1);
        }
    }

    app.use(cors({
        origin: ["https://saellogibot.com", "https://www.saellogibot.com"],
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "x-api-key", "X-API-KEY"]
    }));

    app.use(corsAccessLogger);
    app.use(cookieParser());
    app.use(express.json({ limit: "10mb" }));
    app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    app.use(passport.initialize());

    app.use(routes);
    setupSwagger(app);

    app.use(corsErrorHandler);
    app.use(errorHandler);

    process.on("unhandledRejection", (reason) => {
        console.error("Unhandled Rejection:", reason);
    });
    process.on("uncaughtException", (err) => {
        console.error("Uncaught Exception:", err);
    });

    const port = parseInt(process.env.PORT || "3000", 10);
    app.listen(port, "0.0.0.0", () => {
        console.log(`Backend rodando na porta ${port}`);
    });
}

initializeApp();