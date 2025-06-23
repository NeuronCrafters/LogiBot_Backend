import "express-async-errors";
import 'dotenv/config';
import cors from "cors";
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from "cookie-parser";
import session from 'express-session';
import passport from 'passport';
import { connectDB } from './config/database';
import { setupSwagger } from "./config/swagger/swaggerConfig";
import './config/socialLogin/passport';
import { routes } from './routes/routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
connectDB();

// ---- Verificação obrigatória de variáveis de ambiente ----
const requiredEnvVars = ['FRONT_URL', 'MONGO_URI', 'JWT_SECRET'];
for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        console.error(`Variável de ambiente ${varName} não definida.`);
        process.exit(1);
    }
}

const FRONT_URL = process.env.FRONT_URL!;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ---- CORS com origem fixa ----
const allowedOrigins = [
    process.env.FRONT_URL,
    process.env.FRONT_URL_TESTE
].filter(Boolean); // remove undefined ou vazio

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
}));

// ---- Middlewares gerais ----
app.use(cookieParser());
app.use(express.json());

// Sessão e autenticação
app.use(session({
    secret: process.env.JWT_SECRET!,
    resave: false,
    saveUninitialized: true,
    cookie: {
        sameSite: NODE_ENV === 'production' ? 'none' : 'lax',
        secure: NODE_ENV === 'production'
    }
}));
app.use(passport.initialize());
app.use(passport.session());

// ---- Rotas e documentação ----
app.use(routes);
setupSwagger(app);
app.use(errorHandler);

// ---- Tratamento de erros globais ----
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "\nReason:", reason);
});
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception thrown:", err);
});

// ---- Inicialização do servidor ----
const port = parseInt(process.env.PORT || '3000', 10);
app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port} - Ambiente: ${NODE_ENV}`);
});
