-- Create user_blocks table to capture block relationships between users
CREATE TABLE "user_blocks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "blocker_id" UUID NOT NULL,
    "blocked_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_blocks_pkey" PRIMARY KEY ("id")
);

-- Prevent duplicate block relationships
CREATE UNIQUE INDEX "user_blocks_blocker_id_blocked_id_key"
    ON "user_blocks"("blocker_id", "blocked_id");

-- Support querying blocks by organization
CREATE INDEX "user_blocks_organization_id_idx"
    ON "user_blocks"("organization_id");

-- Maintain referential integrity with existing tables
ALTER TABLE "user_blocks"
    ADD CONSTRAINT "user_blocks_organization_id_fkey"
        FOREIGN KEY ("organization_id")
        REFERENCES "organizations"("id")
        ON DELETE RESTRICT
        ON UPDATE CASCADE;

ALTER TABLE "user_blocks"
    ADD CONSTRAINT "user_blocks_blocker_id_fkey"
        FOREIGN KEY ("blocker_id")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;

ALTER TABLE "user_blocks"
    ADD CONSTRAINT "user_blocks_blocked_id_fkey"
        FOREIGN KEY ("blocked_id")
        REFERENCES "user"("id")
        ON DELETE CASCADE
        ON UPDATE CASCADE;
