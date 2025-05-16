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

// ---- VARIÁVEIS DE AMBIENTE ----
const FRONT_URL = process.env.FRONT_URL!;
const API_KEY   = process.env.API_KEY!;

if (!FRONT_URL || !API_KEY) {
    console.error('Erro de conexão com o servidor');
    process.exit(1);
}

// ---- CORS ----
// const corsOptions: cors.CorsOptions = {
//     origin: (origin, callback) => {
//         if (origin === FRONT_URL) {
//             return callback(null, true);
//         }
//         console.warn(`[CORS] Origem bloqueada: ${origin}`);
//         return callback(new Error("Not allowed by CORS"), false);
//     },
//     credentials: true,
//     methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
//     allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
// };

//app.use(cors(corsOptions));
//app.options("*", cors(corsOptions));

// ---- CORS TEMPORÁRIO ----
app.use(cors({
    origin: true, // Aceita qualquer origem (ideal só para dev)
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"]
}));

// ---- MIDDLEWARE DE API KEY ----
// function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
//     const key = req.header('x-api-key');
//     if (!key || key !== API_KEY) {
//         return res.status(403).json({ message: 'Forbidden: Invalid API Key' });
//     }
//     next();
// }

// ---- MIDDLEWARE DE API KEY TEMPORÁRIO ----
// ---- MIDDLEWARE DE API KEY (ignorado se não enviado) ----
function apiKeyMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = req.header('x-api-key');

    // Se nenhuma chave foi enviada, permite continuar (somente em desenvolvimento)
    if (!key) {
        console.warn("[API KEY] Nenhuma chave enviada, liberando acesso por ser ambiente de desenvolvimento.");
        return next();
    }

    // Se foi enviada mas está errada, bloqueia
    if (key !== API_KEY) {
        return res.status(403).json({ message: 'Forbidden: Invalid API Key' });
    }

    next();
}


// ---- MIDDLEWARES GERAIS ----
app.use(cookieParser());
app.use(express.json());

// Protege todas as rotas da sua API
app.use(apiKeyMiddleware);

// Sessão e Passport
app.use(
    session({
        secret: process.env.SESSION_SECRET || 'defaultSecret',
        resave: false,
        saveUninitialized: true,
    })
);
app.use(passport.initialize());
app.use(passport.session());

// ---- ROTAS, SWAGGER E HANDLER DE ERROS ----
app.use(routes);
setupSwagger(app);
app.use(errorHandler);

// ---- TRATAMENTO DE ERROS GLOBAIS ----
process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "\nReason:", reason);
});
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception thrown:", err);
});

// ---- INICIA SERVIDOR ----
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
