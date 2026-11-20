import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  // Integration suites seed PostgreSQL and start the app in their hooks; 5 s is too tight on a busy machine.
  testTimeout: 30000,
};

export default config;

