-- ----------------------
-- Table structure for `user`
-- ----------------------
CREATE TABLE `user` (
                      `id` VARCHAR(36) NOT NULL PRIMARY KEY,
                      `name` VARCHAR(255) NOT NULL,
                      `email` VARCHAR(255) NOT NULL,
                      `emailVerified` BOOLEAN NOT NULL DEFAULT FALSE,
                      `image` TEXT,
                      `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                      `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                      `role` VARCHAR(16) NOT NULL DEFAULT 'user',
                      `profileImageUrl` TEXT,
                      `username` VARCHAR(50),
                      `displayUsername` VARCHAR(50)
);

-- Indexes for `user`
CREATE UNIQUE INDEX `user_email_key` ON `user`(`email`);
CREATE UNIQUE INDEX `user_username_key` ON `user`(`username`);

-- ----------------------
-- Table structure for `quack`
-- ----------------------
CREATE TABLE `quack` (
                       `id` VARCHAR(36) NOT NULL PRIMARY KEY,
                       `text` TEXT NOT NULL,
                       `userId` VARCHAR(36) NOT NULL,
                       `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                       `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                       CONSTRAINT `quack_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ----------------------
-- Table structure for `session`
-- ----------------------
CREATE TABLE `session` (
                         `id` VARCHAR(36) NOT NULL PRIMARY KEY,
                         `expiresAt` DATETIME NOT NULL,
                         `token` VARCHAR(255) NOT NULL,
                         `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                         `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                         `ipAddress` VARCHAR(45),
                         `userAgent` TEXT,
                         `userId` VARCHAR(36) NOT NULL,
                         `activeOrganizationId` VARCHAR(36),
                         CONSTRAINT `session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for `session`
CREATE UNIQUE INDEX `session_token_key` ON `session`(`token`);

-- ----------------------
-- Table structure for `account`
-- ----------------------
CREATE TABLE `account` (
                         `id` VARCHAR(36) NOT NULL PRIMARY KEY,
                         `accountId` VARCHAR(255) NOT NULL,
                         `providerId` VARCHAR(255) NOT NULL,
                         `userId` VARCHAR(36) NOT NULL,
                         `accessToken` TEXT,
                         `refreshToken` TEXT,
                         `idToken` TEXT,
                         `accessTokenExpiresAt` DATETIME,
                         `refreshTokenExpiresAt` DATETIME,
                         `scope` TEXT,
                         `password` TEXT,
                         `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                         `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                         CONSTRAINT `account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
);

-- ----------------------
-- Table structure for `verification`
-- ----------------------
CREATE TABLE `verification` (
                              `id` VARCHAR(36) NOT NULL PRIMARY KEY,
                              `identifier` VARCHAR(255) NOT NULL,
                              `value` TEXT NOT NULL,
                              `expiresAt` DATETIME NOT NULL,
                              `createdAt` DATETIME DEFAULT CURRENT_TIMESTAMP,
                              `updatedAt` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
