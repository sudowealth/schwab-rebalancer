-- Add userId columns to sleeve and model tables for proper user isolation

-- Add userId column to sleeve table (nullable initially, no foreign key yet)
ALTER TABLE `sleeve` ADD `userId` text;

-- Add userId column to model table (nullable initially, no foreign key yet)
ALTER TABLE `model` ADD `userId` text;

-- Create a demo user if it doesn't exist
INSERT OR IGNORE INTO `user` (id, email, name, role, createdAt, updatedAt) 
VALUES ('demo-user', 'demo@example.com', 'Demo User', 'user', unixepoch('now') * 1000, unixepoch('now') * 1000);

-- Set default userId for existing data
UPDATE `sleeve` SET `userId` = 'demo-user' WHERE `userId` IS NULL;
UPDATE `model` SET `userId` = 'demo-user' WHERE `userId` IS NULL;

-- Create unique constraints to prevent duplicate names per user
CREATE UNIQUE INDEX `idx_sleeve_user_name` ON `sleeve`(`userId`, `name`);
CREATE UNIQUE INDEX `idx_model_user_name` ON `model`(`userId`, `name`);