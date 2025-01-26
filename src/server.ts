import 'dotenv/config';
import cors from "cors";
import express from 'express';
import passport from 'passport';
import './config/socialLogin/passport';
import session from 'express-session';
import { connectDB } from './config/database';
import { routes } from './routes/routes';
import { errorHandler } from './middlewares/errorHandler';

const app = express();
app.use(express.json());
app.use(cors());

connectDB();

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

app.use(errorHandler);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});
