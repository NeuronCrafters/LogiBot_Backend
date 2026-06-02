export const DEFAULT_APP_PORT = 43187;

const REQUIRED_BOOTSTRAP_ENV_VARS = ["FRONT_URL", "DATABASE_URL", "JWT_SECRET"] as const;

export function getRequiredBootstrapEnvVars() {
  return REQUIRED_BOOTSTRAP_ENV_VARS;
}

export function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`variavel de ambiente necessaria ausente: ${name}`);
  }
  return value;
}

export function parsePort(value: string, name = "PORT") {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} invalida: ${value}`);
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
