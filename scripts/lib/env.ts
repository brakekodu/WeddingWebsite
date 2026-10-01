/** Loads .env.local for CLI scripts (Next.js does this itself for the app). */
import { existsSync } from "node:fs";

export function loadLocalEnv(): void {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
}

export function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Add it to .env.local (see .env.example and README.md).`);
    process.exit(1);
  }
  return value;
}
