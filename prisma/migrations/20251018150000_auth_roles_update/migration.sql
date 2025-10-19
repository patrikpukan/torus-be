-- Alter enum user_role to support hierarchical roles
ALTER TYPE "user_role" RENAME VALUE 'admin' TO 'system_admin';
ALTER TYPE "user_role" ADD VALUE 'org_admin';

-- Introduce profile status enum used to track onboarding
CREATE TYPE "profile_status" AS ENUM ('pending', 'active', 'suspended');

-- Extend user table with profile status metadata
ALTER TABLE "user" ADD COLUMN "profileStatus" "profile_status" NOT NULL DEFAULT 'pending';

-- Track organisation-level administrators by email allowlist
CREATE TABLE "org_admin" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "org_admin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_admin_email_key" ON "org_admin"("email");
