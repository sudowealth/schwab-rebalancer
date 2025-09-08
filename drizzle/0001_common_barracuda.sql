PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_account`("id", "userId", "name", "type", "balance", "createdAt", "updatedAt") SELECT "id", "userId", "name", "type", CAST(ROUND(CAST("balance" AS REAL) * 100) AS INTEGER), "createdAt", "updatedAt" FROM `account`;--> statement-breakpoint
DROP TABLE `account`;--> statement-breakpoint
ALTER TABLE `__new_account` RENAME TO `account`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_holding` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`sleeveId` text,
	`ticker` text NOT NULL,
	`qty` integer NOT NULL,
	`costBasis` integer NOT NULL,
	`openedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_holding`("id", "accountId", "sleeveId", "ticker", "qty", "costBasis", "openedAt", "createdAt", "updatedAt") SELECT "id", "accountId", "sleeveId", "ticker", CAST("qty" AS INTEGER), CAST(ROUND(CAST("costBasis" AS REAL) * 100) AS INTEGER), "openedAt", "createdAt", "updatedAt" FROM `holding`;--> statement-breakpoint
DROP TABLE `holding`;--> statement-breakpoint
ALTER TABLE `__new_holding` RENAME TO `holding`;--> statement-breakpoint
CREATE TABLE `__new_restricted_security` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`sleeveId` text NOT NULL,
	`lossAmount` integer NOT NULL,
	`soldAt` integer NOT NULL,
	`blockedUntil` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_restricted_security`("id", "ticker", "sleeveId", "lossAmount", "soldAt", "blockedUntil", "createdAt", "updatedAt") SELECT "id", "ticker", "sleeveId", CAST(ROUND(CAST("lossAmount" AS REAL) * 100) AS INTEGER), "soldAt", "blockedUntil", "createdAt", "updatedAt" FROM `restricted_security`;--> statement-breakpoint
DROP TABLE `restricted_security`;--> statement-breakpoint
ALTER TABLE `__new_restricted_security` RENAME TO `restricted_security`;--> statement-breakpoint
CREATE TABLE `__new_security` (
	`ticker` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`marketCap` integer,
	`peRatio` integer,
	`industry` text,
	`sector` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_security`("ticker", "name", "price", "marketCap", "peRatio", "industry", "sector", "createdAt", "updatedAt") SELECT "ticker", "name", CAST(ROUND(CAST("price" AS REAL) * 100) AS INTEGER), CASE WHEN "marketCap" IS NULL THEN NULL ELSE CAST(REPLACE(REPLACE("marketCap", 'B', '000'), 'M', '') AS INTEGER) END, CASE WHEN "peRatio" IS NULL THEN NULL ELSE CAST(ROUND(CAST("peRatio" AS REAL) * 100) AS INTEGER) END, "industry", "sector", "createdAt", "updatedAt" FROM `security`;--> statement-breakpoint
DROP TABLE `security`;--> statement-breakpoint
ALTER TABLE `__new_security` RENAME TO `security`;--> statement-breakpoint
CREATE TABLE `__new_transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`sleeveId` text,
	`ticker` text NOT NULL,
	`type` text NOT NULL,
	`qty` integer NOT NULL,
	`price` integer NOT NULL,
	`realizedGainLoss` integer,
	`executedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_transaction`("id", "accountId", "sleeveId", "ticker", "type", "qty", "price", "realizedGainLoss", "executedAt", "createdAt", "updatedAt") SELECT "id", "accountId", "sleeveId", "ticker", "type", CAST("qty" AS INTEGER), CAST(ROUND(CAST("price" AS REAL) * 100) AS INTEGER), CASE WHEN "realizedGainLoss" IS NULL THEN NULL ELSE CAST(ROUND(CAST("realizedGainLoss" AS REAL) * 100) AS INTEGER) END, "executedAt", "createdAt", "updatedAt" FROM `transaction`;--> statement-breakpoint
DROP TABLE `transaction`;--> statement-breakpoint
ALTER TABLE `__new_transaction` RENAME TO `transaction`;