-- Drop the deprecated accountId column from sleeve table
-- First, we need to drop the foreign key constraint
PRAGMA foreign_keys=OFF;

-- Create a new table without accountId
CREATE TABLE `sleeve_new` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

-- Copy data from old table to new table
INSERT INTO `sleeve_new` (id, userId, name, isActive, createdAt, updatedAt)
SELECT id, userId, name, isActive, createdAt, updatedAt FROM `sleeve`;

-- Drop the old table
DROP TABLE `sleeve`;

-- Rename the new table to the original name
ALTER TABLE `sleeve_new` RENAME TO `sleeve`;

-- Re-create the unique constraint
CREATE UNIQUE INDEX `sleeve_userId_name_unique` ON `sleeve` (`userId`,`name`);

-- Re-enable foreign keys
PRAGMA foreign_keys=ON;