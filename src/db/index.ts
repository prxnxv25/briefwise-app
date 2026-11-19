import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

let database: NeonHttpDatabase<typeof schema> | undefined;
export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured. Add your Neon connection string to .env.local.");
  if (!database) database = drizzle(neon(url), { schema });
  return database;
}
