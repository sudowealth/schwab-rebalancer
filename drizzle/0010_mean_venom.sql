CREATE TABLE `schwab_credentials` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`encryptedAccessToken` text NOT NULL,
	`encryptedRefreshToken` text NOT NULL,
	`tokenExpiresAt` integer NOT NULL,
	`refreshTokenExpiresAt` integer NOT NULL,
	`schwabClientId` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sync_log` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`syncType` text NOT NULL,
	`status` text NOT NULL,
	`recordsProcessed` integer DEFAULT 0 NOT NULL,
	`errorMessage` text,
	`startedAt` integer NOT NULL,
	`completedAt` integer,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `account` ADD `schwabAccountId` text;--> statement-breakpoint
ALTER TABLE `account` ADD `dataSource` text DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `account` ADD `lastSyncAt` integer;--> statement-breakpoint
ALTER TABLE `holding` ADD `schwabPositionId` text;--> statement-breakpoint
ALTER TABLE `holding` ADD `dataSource` text DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE `holding` ADD `lastSyncAt` integer;