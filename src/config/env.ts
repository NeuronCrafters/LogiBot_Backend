export const DEFAULT_APP_PORT = 43187;
export const DEFAULT_FRONTEND_ORIGIN = "https://saellogibot.com";
export const AUTH_COOKIE_DOMAIN = ".saellogibot.com";

const REQUIRED_BOOTSTRAP_ENV_VARS = ["DATABASE_URL", "JWT_SECRET"] as const;

export const FRONTEND_ORIGINS = [
  DEFAULT_FRONTEND_ORIGIN,
  "https://www.saellogibot.com",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:3000",
  "http://localhost:3001",
] as const;

export function getRequiredBootstrapEnvVars() {
  return REQUIRED_BOOTSTRAP_ENV_VARS;
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable is missing: ${name}`);
  }
  return value;
}

export function parsePort(value: string, name = "PORT") {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid ${name}: ${value}`);
  }
  return port;
}

export function getAppPort() {
  const value = process.env.PORT;
  return value ? parsePort(value) : DEFAULT_APP_PORT;
}

export function getConfiguredAppPort() {
  return getAppPort();
}

export function getLocalBackendOrigin() {
  return `http://localhost:${getAppPort()}`;
}

export function getAllowedFrontendOrigins() {
  return [...FRONTEND_ORIGINS];
}

export function getFrontendOrigin(candidate?: string) {
  if (candidate && getAllowedFrontendOrigins().includes(candidate as typeof FRONTEND_ORIGINS[number])) {
    return candidate;
  }

  return DEFAULT_FRONTEND_ORIGIN;
}
