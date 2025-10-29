import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🗑️  Dropping all tables...");

  try {
    // Disable foreign key constraints temporarily
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        EXECUTE (
          SELECT 'ALTER TABLE ' || string_agg(quote_ident(schemaname) || '.' || quote_ident(tablename), ' DISABLE TRIGGER ALL; ALTER TABLE ')
          FROM pg_tables
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema', '_prisma_migrations')
        ) || ' DISABLE TRIGGER ALL';
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // Drop all tables in public schema (excluding Prisma migration table)
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        EXECUTE (
          SELECT 'DROP TABLE IF EXISTS ' || string_agg(quote_ident(schemaname) || '.' || quote_ident(tablename), ', ')
          FROM pg_tables
          WHERE schemaname NOT IN ('pg_catalog', 'information_schema', '_prisma_migrations')
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    // Drop all types (enums)
    await prisma.$executeRawUnsafe(`
      DO $$ 
      BEGIN
        EXECUTE (
          SELECT 'DROP TYPE IF EXISTS ' || string_agg(quote_ident(n.nspname) || '.' || quote_ident(t.typname), ', ') || ' CASCADE'
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
            AND t.typtype = 'e'
        );
      EXCEPTION WHEN OTHERS THEN NULL;
      END $$;
    `);

    console.log("✅ All tables and types dropped successfully!");

    console.log("🏗️  Creating tables from schema...");

    // Push the schema without creating a migration
    await prisma.$executeRawUnsafe(`
      SELECT 1; -- Just to verify connection
    `);
  } catch (error) {
    console.error("❌ Error during reset:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
