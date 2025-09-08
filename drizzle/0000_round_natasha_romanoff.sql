CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`balance` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `auth_account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `holding` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`sleeveId` text,
	`ticker` text NOT NULL,
	`qty` text NOT NULL,
	`costBasis` text NOT NULL,
	`openedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `restricted_security` (
	`id` text PRIMARY KEY NOT NULL,
	`ticker` text NOT NULL,
	`sleeveId` text NOT NULL,
	`lossAmount` text NOT NULL,
	`soldAt` integer NOT NULL,
	`blockedUntil` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `security` (
	`ticker` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price` text NOT NULL,
	`marketCap` text,
	`peRatio` text,
	`industry` text,
	`sector` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `sleeve` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`name` text NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sleeve_member` (
	`id` text PRIMARY KEY NOT NULL,
	`sleeveId` text NOT NULL,
	`ticker` text NOT NULL,
	`rank` integer NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`isRestricted` integer DEFAULT false NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transaction` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`sleeveId` text,
	`ticker` text NOT NULL,
	`type` text NOT NULL,
	`qty` text NOT NULL,
	`price` text NOT NULL,
	`realizedGainLoss` text,
	`executedAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer,
	`name` text,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
