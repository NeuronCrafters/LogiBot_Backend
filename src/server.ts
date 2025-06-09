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
const requiredEnvVars = ['FRONT_URL', 'API_KEY', 'MONGO_URI', 'JWT_SECRET'];
for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        console.error(`Variável de ambiente ${varName} não definida.`);
        process.exit(1);
    }
}

const FRONT_URL = process.env.FRONT_URL!;
const FRONT_URL_TESTE = process.env.FRONT_URL_TESTE || "http://localhost:5173";
const API_KEY = process.env.API_KEY!;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ---- CORS Dinâmico ----
const allowedOrigins = [
    FRONT_URL,
    FRONT_URL_TESTE,
    "http://localhost:5173",
    "http://127.0.0.1:5173"
];

// app.use(cors({
//     origin: (origin, callback) => {
//         if (!origin || allowedOrigins.includes(origin)) {
//             callback(null, true);
//         } else {
//             console.warn(`[CORS] Origem bloqueada: ${origin}`);
//             callback(new Error("Not allowed by CORS"));
//         }
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
// }));

app.use(cors({
    origin: (origin, callback) => {
        callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
}));


// ---- Middleware de API Key ----
function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = req.header('x-api-key');

    if (!key && NODE_ENV !== 'production') {
        console.warn("[API KEY] Nenhuma chave enviada, liberando acesso (somente dev).");
        return next();
    }

    if (key !== API_KEY) {
        return res.status(403).json({ message: 'Forbidden: Invalid API Key' });
    }

    next();
}

// ---- Middlewares gerais ----
app.use(cookieParser());
app.use(express.json());
app.use(apiKeyMiddleware);

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
