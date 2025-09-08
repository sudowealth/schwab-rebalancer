-- Add role column to user table for RBAC (defaults to 'user')
ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user';

-- Create central audit_log table
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL REFERENCES user(id),
  action TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT,
  metadata TEXT,
  createdAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT
);

-- Helpful indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_userId ON audit_log(userId);
CREATE INDEX IF NOT EXISTS idx_audit_log_createdAt ON audit_log(createdAt);


