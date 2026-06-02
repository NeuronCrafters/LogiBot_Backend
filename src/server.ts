import "express-async-errors";
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { connectDB } from "./config/database";
import { setupSwagger } from "./config/swagger/swaggerConfig";
import { routes } from "./routes/routes";
import { errorHandler } from "./middlewares/errorHandler/errorHandler";
import { corsErrorHandler } from "./middlewares/corsErrorHandler/corsErrorHandler";
import { corsAccessLogger } from "./middlewares/corsErrorHandler/corsAccessLogger";
import { initAdminUser } from "./config/initAdminUser/initAdminUser";
import { closeDatabasePool } from "./db/client";

export const app = express();

const allowedOrigins = [
  "https://saellogibot.com",
  "https://www.saellogibot.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:5174",
  process.env.FRONT_URL,
].filter(Boolean) as string[];

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`origin '${origin}' nao permitido pelo cors`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "X-Requested-With", "x-api-key", "X-API-Key"],
  exposedHeaders: ["Set-Cookie"],
  maxAge: 86400,
}));

app.use(corsAccessLogger);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(routes);
setupSwagger(app);
app.use(corsErrorHandler);
app.use(errorHandler);

export async function bootstrap() {
  const requiredEnvVars = ["FRONT_URL", "DATABASE_URL", "JWT_SECRET"];
  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      throw new Error(`variavel de ambiente necessaria ausente: ${varName}`);
    }
  }

  console.log("tentando conectar ao postgresql...");
  await connectDB();
  console.log("conexao com postgresql bem-sucedida.");

  await initAdminUser();
  console.log("verificacao do usuario admin concluida.");

  const port = parseInt(process.env.PORT || "3000", 10);
  const server = createServer(app);

  server.listen(port, "0.0.0.0", () => {
    console.log(`servidor express rodando em http://0.0.0.0:${port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`recebido ${signal}, encerrando servidor...`);
    server.close(async () => {
      await closeDatabasePool();
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => console.error("unhandled rejection:", reason));
  process.on("uncaughtException", (error) => console.error("uncaught exception:", error));

  return server;
}

if (require.main === module) {
  bootstrap().catch((error) => {
    console.error("erro critico na inicializacao:", error);
    process.exit(1);
  });
}
