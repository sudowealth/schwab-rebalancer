ALTER TABLE "account" ALTER COLUMN "createdAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "account" ALTER COLUMN "updatedAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "holding" ALTER COLUMN "openedAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "model" ALTER COLUMN "createdAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "model" ALTER COLUMN "updatedAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "model_group_assignment" ALTER COLUMN "createdAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "model_group_assignment" ALTER COLUMN "updatedAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "restricted_security" ALTER COLUMN "soldAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "restricted_security" ALTER COLUMN "blockedUntil" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "sleeve" ALTER COLUMN "createdAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "sleeve" ALTER COLUMN "updatedAt" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "transaction" ALTER COLUMN "executedAt" SET DATA TYPE bigint;