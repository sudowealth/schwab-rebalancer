-- Alter transaction.qty from INTEGER to REAL
PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_transaction` (
  `id` text PRIMARY KEY NOT NULL,
  `accountId` text NOT NULL,
  `sleeveId` text,
  `ticker` text NOT NULL,
  `type` text NOT NULL,
  `qty` real NOT NULL,
  `price` real NOT NULL,
  `realizedGainLoss` real,
  `executedAt` integer NOT NULL,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`sleeveId`) REFERENCES `sleeve`(`id`) ON UPDATE no action ON DELETE set null,
  FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);

INSERT INTO `__new_transaction`(
  `id`, `accountId`, `sleeveId`, `ticker`, `type`, `qty`, `price`, `realizedGainLoss`, `executedAt`, `createdAt`, `updatedAt`
)
SELECT 
  t.`id`,
  t.`accountId`,
  CASE 
    WHEN t.`sleeveId` IS NULL THEN NULL
    WHEN EXISTS (SELECT 1 FROM `sleeve` s WHERE s.`id` = t.`sleeveId`) THEN t.`sleeveId`
    ELSE NULL
  END AS `sleeveId`,
  t.`ticker`,
  t.`type`,
  CAST(t.`qty` AS REAL) AS `qty`,
  CAST(t.`price` AS REAL) AS `price`,
  t.`realizedGainLoss`,
  t.`executedAt`,
  t.`createdAt`,
  t.`updatedAt`
FROM `transaction` t
WHERE EXISTS (SELECT 1 FROM `account` a WHERE a.`id` = t.`accountId`)
  AND EXISTS (SELECT 1 FROM `security` se WHERE se.`ticker` = t.`ticker`);

DROP TABLE `transaction`;
ALTER TABLE `__new_transaction` RENAME TO `transaction`;

PRAGMA foreign_keys=ON;


