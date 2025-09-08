-- Add assetTypeSub column to security table
ALTER TABLE `security` ADD `assetTypeSub` text;

-- Note: Allowed values (not enforced at DB level):
-- COE, PRF, ADR, GDR, CEF, ETF, ETN, UIT, WAR, RGT, OEF, MMF


