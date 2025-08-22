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

const app = express();
connectDB();

const requiredEnvVars = ['FRONT_URL', 'MONGO_URI', 'JWT_SECRET'];
for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
        console.error(`Variável de ambiente ${varName} não definida.`);
        process.exit(1);
    }
}

const NODE_ENV = process.env.NODE_ENV || 'development';

// Configuração dos origins permitidos
const allowedOrigins = [
    process.env.FRONT_URL,
    process.env.FRONT_URL_TESTE,
    'https://www.saellogibot.com',
    'https://saellogibot.com',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://localhost:5174'
].filter(Boolean);

console.log('🌐 CORS configurado');
console.log('📍 Origins permitidas:', allowedOrigins);

// CONFIGURAÇÃO CORS ÚNICA E COMPLETA
app.use(cors({
    origin: (origin, callback) => {
        // Log de debug
        console.log(`📨 Origin da requisição: ${origin || 'sem origin'}`);

        // Permite requisições sem origin (Postman, apps mobile, etc.)
        if (!origin) {
            console.log('✅ Requisição sem origin permitida');
            return callback(null, true);
        }

        // Verifica se o origin está na lista permitida
        if (allowedOrigins.includes(origin)) {
            console.log('✅ Origin permitido:', origin);
            return callback(null, true);
        }

        console.warn('❌ Origin NÃO permitido:', origin);
        console.warn('📋 Origins válidos:', allowedOrigins);
        return callback(new Error(`Origin '${origin}' não permitido pelo CORS`));
    },
    credentials: true, // Permite cookies e headers de autenticação
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "x-api-key",
        "Cache-Control",
        "Pragma"
    ],
    exposedHeaders: [
        "Set-Cookie",
        "Content-Length",
        "Content-Range"
    ],
    preflightContinue: false,
    optionsSuccessStatus: 200,
    maxAge: 86400 // Cache preflight por 24 horas
}));

// Middleware de logging (opcional - apenas para debug)
app.use((req, res, next) => {
    console.log(`📨 ${req.method} ${req.path} - Origin: ${req.headers.origin || 'sem origin'}`);
    next();
});

// Middleware básico
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(passport.initialize());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        cors: 'Configured',
        allowedOrigins: allowedOrigins.length
    });
});

// Rotas principais
app.use(routes);
setupSwagger(app);

// Middleware de tratamento de erros CORS
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.message && err.message.includes('não permitido pelo CORS')) {
        console.error('🚫 CORS Error:', err.message);
        return res.status(403).json({
            error: 'Acesso negado pelo CORS',
            origin: req.headers.origin,
            allowedOrigins
        });
    }
    next(err);
});

app.use(errorHandler);

// Error handlers para processos
process.on("unhandledRejection", (reason, promise) => {
    console.error("🔥 Unhandled Rejection at:", promise, "\nReason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("💥 Uncaught Exception thrown:", err);
});

const port = parseInt(process.env.PORT || '3000', 10);
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${port} - Ambiente: ${NODE_ENV}`);
    console.log(`🔒 CORS ativo para ${allowedOrigins.length} origins`);
});