import { getWorkerDb } from "../../db/client";
import type { Env } from "../types";

export function getDb(env: Env) {
  return getWorkerDb(env);
}
