CREATE TABLE `model` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `model_member` (
	`id` text PRIMARY KEY NOT NULL,
	`modelId` text NOT NULL,
	`sleeveId` text NOT NULL,
	`targetWeight` integer NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`modelId`) REFERENCES `model`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE cascade
);
