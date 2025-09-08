-- Migrate legacy CASH ticker to $$$ to avoid conflicts with real ticker
-- Safe approach: insert $$$ if missing, repoint references, then remove CASH

BEGIN TRANSACTION;

-- 1) Create $$$ security by cloning CASH if it doesn't exist yet
INSERT INTO security (ticker, name, price, marketCap, peRatio, industry, sector, assetType, createdAt, updatedAt)
SELECT '$$$', name, price, marketCap, peRatio, industry, sector, assetType, createdAt, updatedAt
FROM security
WHERE ticker = 'CASH'
  AND NOT EXISTS (SELECT 1 FROM security WHERE ticker = '$$$');

-- 2) Update referencing tables to point to $$$ instead of CASH
UPDATE holding SET ticker = '$$$' WHERE ticker = 'CASH';
UPDATE "transaction" SET ticker = '$$$' WHERE ticker = 'CASH';
UPDATE sleeve_member SET ticker = '$$$' WHERE ticker = 'CASH';
UPDATE index_member SET securityId = '$$$' WHERE securityId = 'CASH';
UPDATE restricted_security SET ticker = '$$$' WHERE ticker = 'CASH';

-- 3) Delete legacy CASH security row if present
DELETE FROM security WHERE ticker = 'CASH';

COMMIT;


