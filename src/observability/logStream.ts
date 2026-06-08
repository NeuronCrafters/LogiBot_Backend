export type LogStreamSource = "backend" | "worker";
export type LogStreamLevel = "INFO" | "WARN" | "ERROR";

export type LogStreamEntry = {
  id: number;
  timestamp: string;
  source: LogStreamSource;
  level: LogStreamLevel;
  scope: string;
  message: string;
  details?: unknown;
};

export type LogStreamEntryInput = {
  timestamp?: string;
  source: LogStreamSource;
  level: LogStreamLevel;
  scope: string;
  message: string;
  details?: unknown;
};

const MAX_BUFFER_SIZE = 500;
const buffer: LogStreamEntry[] = [];
const subscribers = new Set<(entry: LogStreamEntry) => void>();
let nextId = 1;

export function recordLogEntry(input: LogStreamEntryInput): LogStreamEntry {
  const entry: LogStreamEntry = {
    id: nextId++,
    timestamp: input.timestamp ?? new Date().toISOString(),
    source: input.source,
    level: input.level,
    scope: input.scope,
    message: input.message,
    details: input.details,
  };

  buffer.push(entry);
  if (buffer.length > MAX_BUFFER_SIZE) buffer.shift();

  for (const subscriber of subscribers) subscriber(entry);

  return entry;
}

export function getRecentLogEntries(): LogStreamEntry[] {
  return [...buffer];
}

export function subscribeToLogEntries(
  callback: (entry: LogStreamEntry) => void,
) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
