import "express-async-errors";
import 'dotenv/config';
import cors from "cors";
import express from 'express';
import cookieParser from "cookie-parser";
import passport from 'passport';
import { connectDB } from './config/database';
import { setupSwagger } from "./config/swagger/swaggerConfig";
import './config/socialLogin/passport';
import { routes } from './routes/routes';
import { errorHandler } from './middlewares/errorHandler/errorHandler';
import { corsConfig, getCorsInfo, logCorsConfig } from './config/cors/ccorsConfig';
import { corsErrorHandler } from './middlewares/corsErrorHandler/corsErrorHandler';
import { corsAccessLogger } from "./middlewares/corsErrorHandler/corsAccessLogger";
import { initAdminUser } from './config/initAdminUser/initAdminUser';

const app = express();

async function initializeApp() {
    try {
        await connectDB();
        await initAdminUser();

    } catch (error) {
        console.error('❌ Falha Crítica na Inicialização da Aplicação ou DB:', error);
        process.exit(1);
    }

    const requiredEnvVars = ['FRONT_URL', 'MONGO_URI', 'JWT_SECRET'];
    for (const varName of requiredEnvVars) {
        if (!process.env[varName]) {
            console.error(`Variável de ambiente ${varName} não definida.`);
            process.exit(1);
        }
    }

    const NODE_ENV = process.env.NODE_ENV || 'development';

    logCorsConfig();
    app.use(cors(corsConfig));
    app.use(corsAccessLogger);

    app.use((req, res, next) => {
        console.log(` ${req.method} ${req.path} - Origin: ${req.headers.origin || 'sem origin'}`);
        next();
    });

    app.use(cookieParser());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use(passport.initialize());

    app.use(routes);
    setupSwagger(app);

    app.use(corsErrorHandler);

    app.use(errorHandler);

    process.on("unhandledRejection", (reason, promise) => {
        console.error("🔥 Unhandled Rejection at:", promise, "\nReason:", reason);
    });

    process.on("uncaughtException", (err) => {
        console.error("💥 Uncaught Exception thrown:", err);
    });

    const port = parseInt(process.env.PORT || '3000', 10);
    app.listen(port, '0.0.0.0', () => {
        const corsInfo = getCorsInfo();

        console.log(`🚀 Servidor rodando na porta ${port} - Ambiente: ${NODE_ENV}`);
        console.log(`🔒 CORS ativo para ${corsInfo.totalOrigins} origins`);
    });
}

initializeApp();