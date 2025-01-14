"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const passport_1 = __importDefault(require("passport"));
require("./config/socialLogin/passport");
const express_session_1 = __importDefault(require("express-session"));
const database_1 = require("./config/database");
const routes_1 = require("./routes/routes");
const errorHandler_1 = require("./middlewares/errorHandler");
const app = (0, express_1.default)();
app.use(express_1.default.json());
(0, database_1.connectDB)();
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'defaultSecret',
    resave: false,
    saveUninitialized: true,
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
app.use(routes_1.routes);
app.use(errorHandler_1.errorHandler);
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port} 🚀`);
});
