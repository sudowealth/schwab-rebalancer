-- Add Financial Planning Tables

CREATE TABLE `financial_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `financial_plan_input` (
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`filingStatus` text DEFAULT 'single' NOT NULL,
	`primaryUserAge` integer NOT NULL,
	`spouseAge` integer,
	`simulationPeriod` integer DEFAULT 50 NOT NULL,
	`returnRate` real DEFAULT 10.0 NOT NULL,
	`inflationRate` real DEFAULT 2.0 NOT NULL,
	`dividendRate` real DEFAULT 2.0 NOT NULL,
	`taxableBalance` real DEFAULT 100000 NOT NULL,
	`taxableCostBasis` real DEFAULT 100000 NOT NULL,
	`rothBalance` real DEFAULT 100000 NOT NULL,
	`deferredBalance` real DEFAULT 100000 NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`planId`) REFERENCES `financial_plan`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `financial_plan_goal` (
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`purpose` text,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`inflationAdjusted` integer DEFAULT true NOT NULL,
	`startTiming` text DEFAULT 'immediately' NOT NULL,
	`durationYears` integer NOT NULL,
	`frequency` text DEFAULT 'annually' NOT NULL,
	`repeatPattern` text DEFAULT 'none' NOT NULL,
	`occurrences` integer DEFAULT 1 NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`planId`) REFERENCES `financial_plan`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE `tax_bracket` (
	`id` text PRIMARY KEY NOT NULL,
	`bracketType` text NOT NULL,
	`filingStatus` text NOT NULL,
	`minIncome` real NOT NULL,
	`maxIncome` real,
	`rate` real NOT NULL,
	`year` integer DEFAULT 2025 NOT NULL,
	`createdAt` integer NOT NULL
);

CREATE TABLE `financial_plan_result` (
	`id` text PRIMARY KEY NOT NULL,
	`planId` text NOT NULL,
	`year` integer NOT NULL,
	`startingTaxable` real NOT NULL,
	`startingRoth` real NOT NULL,
	`startingDeferred` real NOT NULL,
	`growthTaxable` real NOT NULL,
	`growthRoth` real NOT NULL,
	`growthDeferred` real NOT NULL,
	`contributionsTaxable` real NOT NULL,
	`contributionsRoth` real NOT NULL,
	`contributionsDeferred` real NOT NULL,
	`withdrawalsTaxable` real NOT NULL,
	`withdrawalsRoth` real NOT NULL,
	`withdrawalsDeferred` real NOT NULL,
	`federalIncomeTax` real NOT NULL,
	`californiaIncomeTax` real NOT NULL,
	`federalCapitalGainsTax` real NOT NULL,
	`californiaCapitalGainsTax` real NOT NULL,
	`federalDividendTax` real NOT NULL,
	`californiaDividendTax` real NOT NULL,
	`totalTaxes` real NOT NULL,
	`endingTaxable` real NOT NULL,
	`endingRoth` real NOT NULL,
	`endingDeferred` real NOT NULL,
	`totalPortfolioNominal` real NOT NULL,
	`totalPortfolioReal` real NOT NULL,
	`calculatedAt` integer NOT NULL,
	FOREIGN KEY (`planId`) REFERENCES `financial_plan`(`id`) ON UPDATE no action ON DELETE cascade
);