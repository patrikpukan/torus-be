import * as fs from "fs";
import * as path from "path";
import { Client } from "pg";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function bootstrapDatabase() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
  }

  console.log("🔧 Bootstrapping database with Supabase Auth sync triggers...");

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.log("✅ Connected to database");

    // Read the bootstrap SQL file
    const sqlFilePath = path.join(__dirname, "../../prisma/bootstrap.sql");
    const sql = fs.readFileSync(sqlFilePath, "utf-8");

    // Execute the SQL
    await client.query(sql);

    console.log("✅ Database triggers installed successfully");
    console.log("   - auth.users INSERT → public.user INSERT");
    console.log("   - auth.users DELETE → public.user DELETE");
    console.log("   - auth.users UPDATE → public.user UPDATE");
  } catch (error) {
    console.error("❌ Error bootstrapping database:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

bootstrapDatabase();
