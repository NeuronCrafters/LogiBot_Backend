import 'dotenv/config';
import cors from "cors";
import express from 'express';
import cookieParser from "cookie-parser";
import { setupSwagger } from "./config/swagger/swaggerConfig";
import passport from 'passport';
import './config/socialLogin/passport';
import session from 'express-session';
import { connectDB } from './config/database';
import { routes } from './routes/routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();

connectDB();

app.use(cookieParser());
app.use(express.json());

const allowedOrigins = (process.env.FRONTEND_URLS || "")
    .split(",")
    .map(url => url.trim());

const corsOptions = {
    origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
    methods: ["GET", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(
    session({
        secret: process.env.SESSION_SECRET || 'defaultSecret',
        resave: false,
        saveUninitialized: true,
    })
);

app.use(passport.initialize());
app.use(passport.session());

app.use(routes);

setupSwagger(app);
app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Servidor rodando na porta ${port}`);
});
