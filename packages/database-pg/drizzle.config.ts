import { defineConfig } from "drizzle-kit";

function drizzleSsl(connectionString: string): { rejectUnauthorized: boolean } | false {
  if (process.env.DATABASE_SSL === "false") return false;
  if (process.env.DATABASE_SSL === "true") return { rejectUnauthorized: false };
  if (/sslmode=require|sslmode=verify-full|ssl=true/i.test(connectionString)) {
    return { rejectUnauthorized: false };
  }
  if (
    process.env.NODE_ENV === "production" &&
    !/localhost|127\.0\.0\.1/.test(connectionString)
  ) {
    return { rejectUnauthorized: false };
  }
  return false;
}

const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://platform:platform@localhost:15432/platform";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
    ssl: drizzleSsl(databaseUrl),
  },
});
