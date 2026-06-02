import type { Express } from "express";
import { getLocalBackendOrigin } from "../env";

export function setupSwagger(app: Express) {
  if (process.env.ENABLE_SWAGGER !== "true") {
    return;
  }

  const swaggerJSDoc = require("swagger-jsdoc") as typeof import("swagger-jsdoc");
  const swaggerUi = require("swagger-ui-express") as typeof import("swagger-ui-express");

  const swaggerSpec = swaggerJSDoc({
    definition: {
      openapi: "3.0.0",
      info: {
        title: "LogiBots.AI API",
        version: "1.0.0",
        description: "Documentacao da API do LogiBots.AI",
      },
      servers: [
        { url: "https://api.saellogibot.com" },
        { url: getLocalBackendOrigin() },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: ["./src/routes/routesPaths/*.ts"],
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}
