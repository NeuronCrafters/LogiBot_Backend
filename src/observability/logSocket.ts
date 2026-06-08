import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { parse as parseCookies } from "cookie";
import jwt from "jsonwebtoken";
import { getAccountById } from "../db/repositories/authRepository";
import { getDb } from "../db/client";
import { normalizeRoles, requireEnv } from "../http/auth";
import { getAllowedOrigins } from "../http/cors";
import { logger } from "../logger";
import {
  getRecentLogEntries,
  recordLogEntry,
  subscribeToLogEntries,
  type LogStreamEntryInput,
} from "./logStream";

const SCOPE = "LogStream";
const ADMIN_NAMESPACE = "/admin/logs";
const INTERNAL_NAMESPACE = "/internal/logs";

async function authenticateAdminSocket(cookieHeader: string | undefined) {
  const cookies = parseCookies(cookieHeader || "");
  const token = cookies.token;
  if (!token) throw new Error("nao autenticado");

  const decoded = jwt.verify(token, requireEnv("JWT_SECRET")) as jwt.JwtPayload & {
    id?: string;
  };
  const id = String(decoded.id || decoded.sub || "");
  if (!id) throw new Error("token invalido");

  const account = await getAccountById(getDb(), id);
  if (!account || account.status !== "active") throw new Error("acesso negado");

  if (!normalizeRoles(account.roles).includes("admin")) {
    throw new Error("acesso restrito a administradores");
  }
}

function setupAdminNamespace(io: SocketIOServer) {
  const namespace = io.of(ADMIN_NAMESPACE);

  namespace.use((socket, next) => {
    authenticateAdminSocket(socket.handshake.headers.cookie)
      .then(() => next())
      .catch((error) => next(new Error(error instanceof Error ? error.message : String(error))));
  });

  namespace.on("connection", (socket) => {
    socket.emit("history", getRecentLogEntries());

    const unsubscribe = subscribeToLogEntries((entry) => {
      socket.emit("log", entry);
    });

    socket.on("disconnect", () => unsubscribe());
  });
}

function setupInternalNamespace(io: SocketIOServer) {
  const namespace = io.of(INTERNAL_NAMESPACE);

  namespace.use((socket, next) => {
    const sharedSecret = process.env.API_KEY;
    if (!sharedSecret) return next(new Error("API_KEY nao configurada"));
    if (socket.handshake.auth?.token !== sharedSecret) {
      return next(new Error("token invalido"));
    }
    return next();
  });

  namespace.on("connection", (socket) => {
    logger.info(SCOPE, "Worker connected to internal log stream.", {
      socketId: socket.id,
    });

    socket.on("log", (entry: Omit<LogStreamEntryInput, "source">) => {
      recordLogEntry({ ...entry, source: "worker" });
    });

    socket.on("disconnect", () => {
      logger.info(SCOPE, "Worker disconnected from internal log stream.", {
        socketId: socket.id,
      });
    });
  });
}

export function setupLogStreaming(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: getAllowedOrigins(), credentials: true },
  });

  setupAdminNamespace(io);
  setupInternalNamespace(io);

  return io;
}
