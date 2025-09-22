-- Convert bigint timestamp columns to timestamp type
-- Security table
ALTER TABLE security ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE security ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Account table
ALTER TABLE account ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE account ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Sleeve table
ALTER TABLE sleeve ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE sleeve ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Sleeve member table
ALTER TABLE sleeve_member ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE sleeve_member ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Holding table
ALTER TABLE holding ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE holding ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);
ALTER TABLE holding ALTER COLUMN "openedAt" TYPE timestamp USING to_timestamp("openedAt" / 1000.0);

-- Transaction table
ALTER TABLE transaction ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE transaction ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);
ALTER TABLE transaction ALTER COLUMN "executedAt" TYPE timestamp USING to_timestamp("executedAt" / 1000.0);

-- Restricted security table
ALTER TABLE restricted_security ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE restricted_security ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);
ALTER TABLE restricted_security ALTER COLUMN "soldAt" TYPE timestamp USING to_timestamp("soldAt" / 1000.0);
ALTER TABLE restricted_security ALTER COLUMN "blockedUntil" TYPE timestamp USING to_timestamp("blockedUntil" / 1000.0);

-- Index table
ALTER TABLE index ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE index ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Index member table
ALTER TABLE index_member ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE index_member ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Model table
ALTER TABLE model ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE model ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Model group assignment table
ALTER TABLE model_group_assignment ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE model_group_assignment ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Model member table
ALTER TABLE model_member ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE model_member ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Rebalancing group table
ALTER TABLE rebalancing_group ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE rebalancing_group ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);

-- Rebalancing group member table
ALTER TABLE rebalancing_group_member ALTER COLUMN "createdAt" TYPE timestamp USING to_timestamp("createdAt" / 1000.0);
ALTER TABLE rebalancing_group_member ALTER COLUMN "updatedAt" TYPE timestamp USING to_timestamp("updatedAt" / 1000.0);
