-- Migration: Rename holding.costBasis -> holding.averageCost
-- Notes:
-- - Cloudflare D1 (SQLite 3.42+) supports ALTER TABLE RENAME COLUMN
-- - This migration assumes the column `costBasis` currently exists
-- - Safe to run once; subsequent runs will no-op or fail gracefully when applied by wrangler

PRAGMA foreign_keys=OFF;

-- Attempt direct rename
ALTER TABLE `holding` RENAME COLUMN `costBasis` TO `averageCost`;

PRAGMA foreign_keys=ON;
