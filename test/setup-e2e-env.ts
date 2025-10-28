if (process.env.DATABASE_URL?.includes("supabase.com") && !process.env.DATABASE_URL.includes("sslmode=")) {
  const separator = process.env.DATABASE_URL.includes("?") ? "&" : "?";
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${separator}sslmode=require`;
}

if (!process.env.SUPABASE_JWT_SECRET) {
  process.env.SUPABASE_JWT_SECRET = "test-secret";
}

export {};
