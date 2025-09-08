PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_holding` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`ticker` text NOT NULL,
	`qty` integer NOT NULL,
	`costBasis` integer NOT NULL,
	`openedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_holding`("id", "accountId", "ticker", "qty", "costBasis", "openedAt", "createdAt", "updatedAt") SELECT "id", "accountId", "ticker", "qty", "costBasis", "openedAt", "createdAt", "updatedAt" FROM `holding`;--> statement-breakpoint
DROP TABLE `holding`;--> statement-breakpoint
ALTER TABLE `__new_holding` RENAME TO `holding`;--> statement-breakpoint
PRAGMA foreign_keys=ON;