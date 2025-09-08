CREATE TABLE `sync_log_detail` (
	`id` text PRIMARY KEY NOT NULL,
	`logId` text NOT NULL,
	`entityType` text NOT NULL,
	`entityId` text NOT NULL,
	`operation` text NOT NULL,
	`changes` text,
	`success` integer DEFAULT true NOT NULL,
	`message` text,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`logId`) REFERENCES `sync_log`(`id`) ON UPDATE no action ON DELETE cascade
);
