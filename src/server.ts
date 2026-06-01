import "express-async-errors";
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/database";
import { setupSwagger } from "./config/swagger/swaggerConfig";
import { routes } from "./routes/routes";
import { errorHandler } from "./middlewares/errorHandler/errorHandler";
import { corsErrorHandler } from "./middlewares/corsErrorHandler/corsErrorHandler";
import { corsAccessLogger } from "./middlewares/corsErrorHandler/corsAccessLogger";
import { initAdminUser } from "./config/initAdminUser/initAdminUser";

const app = express();

async function initializeApp() {
  try {
    console.log("tentando conectar ao postgresql...");
    await connectDB();
    console.log("conexao com postgresql bem-sucedida.");

    await initAdminUser();
    console.log("verificacao do usuario admin concluida.");
  } catch (error) {
    console.error("erro critico na inicializacao. o processo sera encerrado:");
    console.error(error);
    process.exit(1);
  }

  const requiredEnvVars = ["FRONT_URL", "DATABASE_URL", "JWT_SECRET"];

  for (const varName of requiredEnvVars) {
    if (!process.env[varName]) {
      console.error(`erro: variavel de ambiente necessaria ausente: ${varName}`);
      process.exit(1);
    }
  }
  console.log("variaveis de ambiente essenciais verificadas.");

  const allowedOrigins = [
    "https://saellogibot.com",
    "https://www.saellogibot.com",
    "http://localhost:3001",
    "http://localhost:5173",
    process.env.FRONT_URL,
  ].filter(Boolean);

  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log("origem bloqueada por cors:", origin);
        callback(new Error("not allowed by cors"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cookie",
      "X-Requested-With",
      "x-api-key",
      "X-API-Key",
    ],
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

  process.on("unhandledRejection", (reason) => { console.error("unhandled rejection:", reason); });
  process.on("uncaughtException", (error) => { console.error("uncaught exception:", error); });

  const port = parseInt(process.env.PORT || "3000", 10);

  console.log(`servidor express pronto para ouvir na porta ${port}...`);

  app.listen(port, "0.0.0.0", () => {
    console.log(`servidor express rodando em http://localhost:${port}`);
  });
}

initializeApp();
