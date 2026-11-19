import "express-async-errors";
import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { environmentMiddleware } from "./http/environment";
import { createServer } from "http";
import { connectDB } from "./config/database";
import { routes } from "./routes/routes";
import { errorHandler } from "./http/errorHandler";
import { corsAccessLogger, corsOptions } from "./http/cors";
import { getAppPort, getRequiredBootstrapEnvVars } from "./config/env";
import { requestLogger } from "./http/requestLogger";
import { logger } from "./logger";

import { languageMiddleware } from "./i18n/middleware";

export const app = express();

app.use(languageMiddleware);

app.use(cors(corsOptions));
app.use(corsAccessLogger);
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(requestLogger);
app.use(environmentMiddleware);
app.use(routes);
app.use(errorHandler);

export async function bootstrap() {
  for (const varName of getRequiredBootstrapEnvVars()) {
    if (!process.env[varName]) {
      throw new Error(`Required environment variable is missing: ${varName}`);
    }
  }

  logger.info("Server", "Starting LogiBot backend.");
  logger.info("Database", "Connecting to PostgreSQL.");
  await connectDB();
  logger.info("Database", "PostgreSQL connection established.");

  // No account is created at startup: the platform owner is created once with `db:create-owner`
  // (password from OWNER_PASSWORD), never with a password written in the code.

  const port = getAppPort();
  const server = createServer(app);

  server.listen(port, () => {
    logger.info("Server", "Express server is listening.", {
      port,
      healthcheck: "/health/simple",
    });
  });

  process.on("unhandledRejection", (reason) =>
    logger.error("Process", "Unhandled promise rejection.", reason),
  );
  process.on("uncaughtException", (error) =>
    logger.error("Process", "Uncaught exception.", error),
  );
  process.on("exit", (code) =>
    logger.info("Process", "Node process exited.", { code }),
  );

  return server;
}

if (require.main === module) {
  bootstrap().catch((error) => {
    logger.error("Server", "Critical startup failure.", error);
    process.exit(1);
  });
}
