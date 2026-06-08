import { io, type Socket } from "socket.io-client";
import { logger, setLoggerSource } from "../logger";
import { subscribeToLogEntries, type LogStreamEntry } from "./logStream";

const SCOPE = "LogForwarder";
const INTERNAL_NAMESPACE = "/internal/logs";

function getBackendInternalUrl() {
  return (process.env.BACKEND_INTERNAL_URL || "http://backend:43187").replace(
    /\/+$/,
    "",
  );
}

let socket: Socket | null = null;

export function startLogForwarding() {
  setLoggerSource("worker");

  const sharedSecret = process.env.API_KEY;
  if (!sharedSecret) {
    logger.warn(SCOPE, "API_KEY not configured; skipping log forwarding to backend.");
    return;
  }

  socket = io(`${getBackendInternalUrl()}${INTERNAL_NAMESPACE}`, {
    auth: { token: sharedSecret },
    reconnection: true,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    logger.info(SCOPE, "Connected to backend log stream.");
  });

  socket.on("connect_error", (error) => {
    logger.warn(SCOPE, "Failed to connect to backend log stream.", {
      message: error instanceof Error ? error.message : String(error),
    });
  });

  subscribeToLogEntries((entry: LogStreamEntry) => {
    if (!socket?.connected) return;
    const { source: _source, id: _id, ...payload } = entry;
    socket.emit("log", payload);
  });
}
