-- Create Schwab raw import tables for accounts, securities, and transactions
PRAGMA foreign_keys=OFF;

-- schwab_account
CREATE TABLE IF NOT EXISTS `schwab_account` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `accountNumber` text NOT NULL,
  `roundTrips` integer,
  `isDayTrader` integer,
  `isClosingOnlyRestricted` integer,
  `pfcbFlag` integer,
  `cashAvailableForTrading` real,
  `cashAvailableForWithdrawal` real,
  `cashCall` real,
  `longNonMarginableMarketValue` real,
  `totalCash` real,
  `cashDebitCallValue` real,
  `unsettledCash` real,
  `importedAt` integer NOT NULL,
  `payload` text
);

-- Uniques / indexes
CREATE UNIQUE INDEX IF NOT EXISTS `uq_schwab_account_accountNumber`
  ON `schwab_account` (`accountNumber`);
CREATE INDEX IF NOT EXISTS `idx_schwab_account_type`
  ON `schwab_account` (`type`);

-- schwab_security
CREATE TABLE IF NOT EXISTS `schwab_security` (
  `id` text PRIMARY KEY NOT NULL,
  `symbol` text NOT NULL,
  `cusip` text,
  `description` text,
  `lastPrice` real,
  `assetMainType` text,
  `assetSubType` text,
  `exchange` text,
  `payload` text,
  `discoveredAt` integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS `uq_schwab_security_symbol`
  ON `schwab_security` (`symbol`);
CREATE INDEX IF NOT EXISTS `idx_schwab_security_cusip`
  ON `schwab_security` (`cusip`);
CREATE INDEX IF NOT EXISTS `idx_schwab_security_discoveredAt`
  ON `schwab_security` (`discoveredAt`);

-- schwab_transaction
CREATE TABLE IF NOT EXISTS `schwab_transaction` (
  `id` text PRIMARY KEY NOT NULL,
  `activityId` integer,
  `time` text,
  `description` text,
  `accountNumber` text NOT NULL,
  `type` text,
  `status` text,
  `subAccount` text,
  `tradeDate` text,
  `settlementDate` text,
  `positionId` integer,
  `orderId` integer,
  `netAmount` real,
  `activityType` text,
  `importedAt` integer NOT NULL,
  `payload` text
);

CREATE UNIQUE INDEX IF NOT EXISTS `uq_schwab_transaction_activityId`
  ON `schwab_transaction` (`activityId`);
CREATE INDEX IF NOT EXISTS `idx_schwab_transaction_accountNumber`
  ON `schwab_transaction` (`accountNumber`);
CREATE INDEX IF NOT EXISTS `idx_schwab_transaction_time`
  ON `schwab_transaction` (`time`);
CREATE INDEX IF NOT EXISTS `idx_schwab_transaction_type`
  ON `schwab_transaction` (`type`);

-- Ensure a consistent index name for holdings account+symbol
CREATE INDEX IF NOT EXISTS `idx_schwab_holding_account_symbol`
  ON `schwab_holding` (`accountNumber`, `symbol`);

PRAGMA foreign_keys=ON;


