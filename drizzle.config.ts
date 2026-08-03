import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't load Next.js env files on its own; Vercel/CI set env directly.
for (const file of [".env.local", ".env"]) {
  if (process.env.DATABASE_URL) break;
  try {
    process.loadEnvFile(file);
  } catch {
    /* file absent — fine */
  }
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
