-- Orders and Executions tables
PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS `trade_order` (
  `id` text PRIMARY KEY NOT NULL,
  `userId` text NOT NULL,
  `accountId` text NOT NULL,
  `symbol` text NOT NULL,
  `side` text NOT NULL,
  `qty` real NOT NULL,
  `type` text NOT NULL DEFAULT 'MARKET',
  `limit` real,
  `stop` real,
  `tif` text NOT NULL DEFAULT 'DAY',
  `session` text NOT NULL DEFAULT 'NORMAL',
  `taxLotMethod` text,
  `specialInstruction` text,
  `quantityType` text,
  `amountIndicator` text,
  `orderStrategyType` text,
  `complexOrderStrategyType` text,
  `requestedDestination` text,
  `destinationLinkName` text,
  `previewJson` text,
  `previewOrderValue` real,
  `previewProjectedCommission` real,
  `previewWarnCount` integer NOT NULL DEFAULT 0,
  `previewErrorCount` integer NOT NULL DEFAULT 0,
  `previewFirstMessage` text,
  `schwabOrderId` text,
  `status` text NOT NULL DEFAULT 'DRAFT',
  `statusDescription` text,
  `cancelable` integer NOT NULL DEFAULT 0,
  `editable` integer NOT NULL DEFAULT 0,
  `quantity` real,
  `filledQuantity` real NOT NULL DEFAULT 0,
  `remainingQuantity` real NOT NULL DEFAULT 0,
  `enteredAt` integer,
  `closeAt` integer,
  `cancelAt` integer,
  `placedAt` integer,
  `closedAt` integer,
  `cusip` text,
  `instrumentId` text,
  `replacesSchwabOrderId` text,
  `replacedBySchwabOrderId` text,
  `avgFillPrice` real,
  `lastFillPrice` real,
  `filledNotional` real,
  `realizedCommission` real,
  `realizedFeesTotal` real,
  `lastSnapshot` text,
  `idempotencyKey` text,
  `batchLabel` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE,
  FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_trade_order_user_account_status` ON `trade_order` (`userId`, `accountId`, `status`);
CREATE INDEX IF NOT EXISTS `idx_trade_order_account_schwab` ON `trade_order` (`accountId`, `schwabOrderId`);
CREATE UNIQUE INDEX IF NOT EXISTS `trade_order_account_idempotency_unique` ON `trade_order` (`accountId`, `idempotencyKey`);

CREATE TABLE IF NOT EXISTS `order_execution` (
  `id` text PRIMARY KEY NOT NULL,
  `orderId` text NOT NULL,
  `legId` integer,
  `time` integer NOT NULL,
  `price` real NOT NULL,
  `qty` real NOT NULL,
  `instrumentId` text,
  `fee` real,
  `raw` text,
  `settlementDate` integer,
  `createdAt` integer NOT NULL,
  FOREIGN KEY (`orderId`) REFERENCES `trade_order`(`id`) ON UPDATE NO ACTION ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `idx_order_execution_order_time` ON `order_execution` (`orderId`, `time`);

PRAGMA foreign_keys=ON;



