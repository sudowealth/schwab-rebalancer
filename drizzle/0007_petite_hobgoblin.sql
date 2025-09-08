CREATE TABLE `model_group_assignment` (
	`id` text PRIMARY KEY NOT NULL,
	`modelId` text NOT NULL,
	`rebalancingGroupId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`modelId`) REFERENCES `model`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`rebalancingGroupId`) REFERENCES `rebalancing_group`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `model_group_assignment_modelId_rebalancingGroupId_unique` ON `model_group_assignment` (`modelId`,`rebalancingGroupId`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_model` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_model`("id", "name", "description", "isActive", "createdAt", "updatedAt") SELECT "id", "name", "description", "isActive", "createdAt", "updatedAt" FROM `model`;--> statement-breakpoint
DROP TABLE `model`;--> statement-breakpoint
ALTER TABLE `__new_model` RENAME TO `model`;--> statement-breakpoint
PRAGMA foreign_keys=ON;