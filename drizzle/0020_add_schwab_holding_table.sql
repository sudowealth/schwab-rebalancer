-- Create raw import table for Schwab positions
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS `schwab_holding` (
  `id` text PRIMARY KEY NOT NULL,
  `accountNumber` text NOT NULL,
  `symbol` text NOT NULL,
  `cusip` text,
  `shortQuantity` real,
  `averagePrice` real,
  `currentDayProfitLoss` real,
  `currentDayProfitLossPercentage` real,
  `longQuantity` real,
  `settledLongQuantity` real,
  `settledShortQuantity` real,
  `agedQuantity` real,
  `marketValue` real,
  `maintenanceRequirement` real,
  `averageLongPrice` real,
  `averageShortPrice` real,
  `taxLotAverageLongPrice` real,
  `taxLotAverageShortPrice` real,
  `longOpenProfitLoss` real,
  `shortOpenProfitLoss` real,
  `previousSessionLongQuantity` real,
  `previousSessionShortQuantity` real,
  `currentDayCost` real,
  `importedAt` integer NOT NULL
);

-- Helpful index for normalization
CREATE INDEX IF NOT EXISTS `idx_schwab_holding_acct_symbol`
  ON `schwab_holding` (`accountNumber`, `symbol`);

PRAGMA foreign_keys=ON;


