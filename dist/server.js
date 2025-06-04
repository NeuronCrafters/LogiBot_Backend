"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("express-async-errors");
require("dotenv/config");
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const database_1 = require("./config/database");
const swaggerConfig_1 = require("./config/swagger/swaggerConfig");
require("./config/socialLogin/passport");
const routes_1 = require("./routes/routes");
const errorHandler_1 = require("./middlewares/errorHandler");
const app = (0, express_1.default)();
(0, database_1.connectDB)();
// ---- VARIÁVEIS DE AMBIENTE ----
const FRONT_URL = process.env.FRONT_URL;
const API_KEY = process.env.API_KEY;
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
app.use((0, cors_1.default)({
    origin: "http://localhost:5173",
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
function apiKeyMiddleware(req, res, next) {
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
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
// Protege todas as rotas da sua API
app.use(apiKeyMiddleware);
// Sessão e Passport
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'defaultSecret',
    resave: false,
    saveUninitialized: true,
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
// ---- ROTAS, SWAGGER E HANDLER DE ERROS ----
app.use(routes_1.routes);
(0, swaggerConfig_1.setupSwagger)(app);
app.use(errorHandler_1.errorHandler);
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
