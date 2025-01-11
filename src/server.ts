import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { connectDB } from "./config/database";
import { routes } from "./routes/routes";
import { AppError } from "./exceptions/AppError";

const app = express();
app.use(express.json());

connectDB();

app.use(routes);

app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            status: 'error',
            message: err.message,
        });
    }

    return res.status(500).json({
        status: 'error',
        message: 'Internal server error',
    });
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port} 🚀`);
});
