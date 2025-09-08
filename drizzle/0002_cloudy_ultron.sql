CREATE TABLE `index` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `index_member` (
	`id` text PRIMARY KEY NOT NULL,
	`indexId` text NOT NULL,
	`securityId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`indexId`) REFERENCES `index`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`securityId`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `account` ADD `accountNumber` text;