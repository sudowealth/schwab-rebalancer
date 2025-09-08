-- Add unique index to enforce uniqueness of accountNumber per user.
-- SQLite allows multiple NULLs; this effectively enforces uniqueness for non-null accountNumber rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_userId_accountNumber_unique
ON account (userId, accountNumber);


