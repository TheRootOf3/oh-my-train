import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Lazy singleton so `next build` can import this module without DATABASE_URL set.
let _db: ReturnType<typeof create> | null = null;

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. The database, much like the 07:43, is missing.");
  }
  return drizzle(neon(url), { schema });
}

export function db() {
  return (_db ??= create());
}
