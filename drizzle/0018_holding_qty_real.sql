-- Alter holding.qty from INTEGER to REAL
PRAGMA foreign_keys=OFF;

CREATE TABLE `__new_holding` (
  `id` text PRIMARY KEY NOT NULL,
  `accountId` text NOT NULL,
  `ticker` text NOT NULL,
  `qty` real NOT NULL,
  `costBasis` real NOT NULL,
  `openedAt` integer NOT NULL,
  `schwabPositionId` text,
  `dataSource` text NOT NULL DEFAULT 'MANUAL',
  `lastSyncAt` integer,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  FOREIGN KEY (`accountId`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`ticker`) REFERENCES `security`(`ticker`) ON UPDATE no action ON DELETE cascade
);

INSERT INTO `__new_holding`(
  `id`, `accountId`, `ticker`, `qty`, `costBasis`, `openedAt`, `schwabPositionId`, `dataSource`, `lastSyncAt`, `createdAt`, `updatedAt`
)
SELECT 
  h.`id`,
  h.`accountId`,
  h.`ticker`,
  CAST(h.`qty` AS REAL) AS `qty`,
  h.`costBasis`,
  h.`openedAt`,
  h.`schwabPositionId`,
  h.`dataSource`,
  h.`lastSyncAt`,
  h.`createdAt`,
  h.`updatedAt`
FROM `holding` h;

DROP TABLE `holding`;
ALTER TABLE `__new_holding` RENAME TO `holding`;

PRAGMA foreign_keys=ON;

