ALTER TABLE "user" ADD COLUMN "failedLoginAttempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "lastFailedLoginAt" timestamp;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "lockedUntil" timestamp;