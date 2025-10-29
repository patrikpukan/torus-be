import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env') });

if (process.env.DATABASE_URL?.includes("supabase.com") && !process.env.DATABASE_URL.includes("sslmode=")) {
  const separator = process.env.DATABASE_URL.includes("?") ? "&" : "?";
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${separator}sslmode=require`;
}

if (!process.env.SUPABASE_JWT_SECRET) {
  process.env.SUPABASE_JWT_SECRET = "test-secret";
}

export {};
