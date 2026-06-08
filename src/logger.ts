import {
  recordLogEntry,
  type LogStreamSource,
} from "./observability/logStream";

type LogLevel = "INFO" | "WARN" | "ERROR";

let logSource: LogStreamSource = "backend";

export function setLoggerSource(source: LogStreamSource) {
  logSource = source;
}

function writeLog(
  level: LogLevel,
  scope: string,
  message: string,
  details?: unknown,
) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${level} [${scope}] ${message}`;

  if (level === "ERROR") {
    details === undefined ? console.error(line) : console.error(line, details);
  } else if (level === "WARN") {
    details === undefined ? console.warn(line) : console.warn(line, details);
  } else {
    details === undefined ? console.log(line) : console.log(line, details);
  }

  recordLogEntry({ timestamp, source: logSource, level, scope, message, details });
}

export const logger = {
  info(scope: string, message: string, details?: unknown) {
    writeLog("INFO", scope, message, details);
  },
  warn(scope: string, message: string, details?: unknown) {
    writeLog("WARN", scope, message, details);
  },
  error(scope: string, message: string, details?: unknown) {
    writeLog("ERROR", scope, message, details);
  },
};
