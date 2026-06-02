import "express-async-errors";
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { connectDB } from "./config/database";
import { setupSwagger } from "./config/swagger/swaggerConfig";
import { routes } from "./routes/routes";
import { errorHandler } from "./http/errorHandler";
import { corsAccessLogger, corsOptions } from "./http/cors";
import { initAdminUser } from "./config/initAdminUser/initAdminUser";
import { closeDatabasePool } from "./db/client";

export const app = express();

app.use(cors(corsOptions));
app.use(corsAccessLogger);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(routes);
setupSwagger(app);
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
