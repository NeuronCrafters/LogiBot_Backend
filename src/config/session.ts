function seconds(name: string, fallback: number, minimum: number) {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isInteger(value) || value < minimum || value > 86400)
    throw new Error(`Invalid ${name}`);
  return value;
}

export function sessionPolicy() {
  const idleSeconds = seconds("SESSION_IDLE_SECONDS", 1800, 120);
  const absoluteSeconds = seconds("SESSION_ABSOLUTE_SECONDS", 7200, 120);
  return {
    idleSeconds, absoluteSeconds,
    heartbeatSeconds: 30,
    activityWindowSeconds: 60,
    warningSeconds: Math.min(120, Math.floor(idleSeconds / 2), Math.floor(absoluteSeconds / 2)),
  };
}
