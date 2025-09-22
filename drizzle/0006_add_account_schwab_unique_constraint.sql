-- Add unique constraint for (userId, schwabAccountId) on account table
ALTER TABLE "account" ADD CONSTRAINT "account_userId_schwabAccountId_unique" UNIQUE ("userId", "schwabAccountId");
