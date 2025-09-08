PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_holding` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`ticker` text NOT NULL,
	`qty` integer NOT NULL,
	`costBasis` real NOT NULL,
	`openedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_holding`("id", "accountId", "ticker", "qty", "costBasis", "openedAt", "createdAt", "updatedAt") SELECT "id", "accountId", "ticker", "qty", CAST("costBasis" AS REAL) / 100.0, "openedAt", "createdAt", "updatedAt" FROM `holding`;--> statement-breakpoint
DROP TABLE `holding`;--> statement-breakpoint
ALTER TABLE `__new_holding` RENAME TO `holding`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_restricted_security` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`sleeveId` text NOT NULL,
	`lossAmount` real NOT NULL,
	`soldAt` integer NOT NULL,
	`blockedUntil` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_restricted_security`("id", "ticker", "sleeveId", "lossAmount", "soldAt", "blockedUntil", "createdAt", "updatedAt") SELECT "id", "ticker", "sleeveId", CAST("lossAmount" AS REAL) / 100.0, "soldAt", "blockedUntil", "createdAt", "updatedAt" FROM `restricted_security`;--> statement-breakpoint
DROP TABLE `restricted_security`;--> statement-breakpoint
ALTER TABLE `__new_restricted_security` RENAME TO `restricted_security`;--> statement-breakpoint
CREATE TABLE `__new_security` (
	`ticker` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`marketCap` integer,
	`peRatio` real,
	`industry` text,
	`sector` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_security`("ticker", "name", "price", "marketCap", "peRatio", "industry", "sector", "createdAt", "updatedAt") SELECT "ticker", "name", CAST("price" AS REAL) / 100.0, "marketCap", CASE WHEN "peRatio" IS NOT NULL THEN CAST("peRatio" AS REAL) / 100.0 ELSE NULL END, "industry", "sector", "createdAt", "updatedAt" FROM `security`;--> statement-breakpoint
DROP TABLE `security`;--> statement-breakpoint
ALTER TABLE `__new_security` RENAME TO `security`;--> statement-breakpoint
CREATE TABLE `__new_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`sleeveId` text,
	`ticker` text NOT NULL,
	`type` text NOT NULL,
	`qty` integer NOT NULL,
	`price` real NOT NULL,
	`realizedGainLoss` real,
	`executedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_transaction`("id", "accountId", "sleeveId", "ticker", "type", "qty", "price", "realizedGainLoss", "executedAt", "createdAt", "updatedAt") SELECT "id", "accountId", "sleeveId", "ticker", "type", "qty", CAST("price" AS REAL) / 100.0, CASE WHEN "realizedGainLoss" IS NOT NULL THEN CAST("realizedGainLoss" AS REAL) / 100.0 ELSE NULL END, "executedAt", "createdAt", "updatedAt" FROM `transaction`;--> statement-breakpoint
DROP TABLE `transaction`;--> statement-breakpoint
ALTER TABLE `__new_transaction` RENAME TO `transaction`;