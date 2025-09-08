PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT '' NOT NULL,
	`accountNumber` text,
	`schwabAccountId` text,
	`dataSource` text DEFAULT 'MANUAL' NOT NULL,
	`lastSyncAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_account`("id", "userId", "name", "type", "accountNumber", "schwabAccountId", "dataSource", "lastSyncAt", "createdAt", "updatedAt") SELECT "id", "userId", "name", COALESCE("type", '') as "type", "accountNumber", "schwabAccountId", "dataSource", "lastSyncAt", "createdAt", "updatedAt" FROM `account`;--> statement-breakpoint
DROP TABLE `account`;--> statement-breakpoint
ALTER TABLE `__new_account` RENAME TO `account`;--> statement-breakpoint
PRAGMA foreign_keys=ON;