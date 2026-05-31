import { MongoClient } from "mongodb";
import type { Env } from "../types";

let clientPromise: Promise<MongoClient> | undefined;

export async function getMongoClient(env: Env) {
  if (!env.MONGO_URI) {
    throw new Error("MONGO_URI nao configurado");
  }

  if (!clientPromise) {
    clientPromise = new MongoClient(env.MONGO_URI).connect();
  }

  return clientPromise;
}

export async function getDb(env: Env) {
  const client = await getMongoClient(env);
  return client.db();
}
