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

const allowedOrigins = [
    process.env.FRONT_URL,
    process.env.FRONT_URL_TESTE,
    'https://www.saellogibot.com',
    'https://saellogibot.com',
    'http://localhost:3000',
    'http://localhost:5173'
].filter(Boolean);

console.log('Origins permitidas:', allowedOrigins);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) {
            console.log('Requisição sem origin permitida');
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            console.log('Origin permitido:', origin);
            callback(null, true);
        } else {
            console.warn('Origin NÃO permitido:', origin);
            console.warn('Origins permitidas:', allowedOrigins);
            callback(new Error(`Origin ${origin} não permitido pelo CORS`));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "x-api-key",
        "Access-Control-Allow-Origin",
        "Access-Control-Allow-Headers",
        "Access-Control-Allow-Methods"
    ],
    exposedHeaders: ["Set-Cookie"],
    preflightContinue: false,
    optionsSuccessStatus: 200
}));

app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (!origin || allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin || '*');
    }

    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS,PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin,X-Requested-With,Content-Type,Accept,Authorization,x-api-key');
    res.header('Access-Control-Expose-Headers', 'Set-Cookie');

    if (req.method === 'OPTIONS') {
        console.log(`Preflight request para: ${req.path}`);
        return res.status(200).end();
    }

    next();
});

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(passport.initialize());

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development'
    });
});

app.use(routes);
setupSwagger(app);
app.use(errorHandler);

process.on("unhandledRejection", (reason, promise) => {
    console.error("Unhandled Rejection at:", promise, "\nReason:", reason);
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception thrown:", err);
});

const port = parseInt(process.env.PORT || '3000', 10);
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${port} - Ambiente: ${NODE_ENV}`);
    console.log(`📍 Origins permitidas: ${allowedOrigins.join(', ')}`);
});