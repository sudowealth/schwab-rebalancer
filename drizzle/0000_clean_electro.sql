CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT '' NOT NULL,
	"accountNumber" text,
	"schwabAccountId" text,
	"dataSource" text DEFAULT 'MANUAL' NOT NULL,
	"lastSyncAt" timestamp,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL,
	CONSTRAINT "account_userId_accountNumber_unique" UNIQUE("userId","accountNumber")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"action" text NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text,
	"metadata" text,
	"createdAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text
);
--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp,
	"refreshTokenExpiresAt" timestamp,
	"scope" text,
	"password" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_plan_goal" (
	"id" text PRIMARY KEY NOT NULL,
	"planId" text NOT NULL,
	"purpose" text,
	"type" text NOT NULL,
	"amount" real NOT NULL,
	"inflationAdjusted" boolean DEFAULT true NOT NULL,
	"startTiming" text DEFAULT 'immediately' NOT NULL,
	"durationYears" integer NOT NULL,
	"frequency" text DEFAULT 'annually' NOT NULL,
	"repeatPattern" text DEFAULT 'none' NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_plan_input" (
	"id" text PRIMARY KEY NOT NULL,
	"planId" text NOT NULL,
	"filingStatus" text DEFAULT 'single' NOT NULL,
	"primaryUserAge" integer NOT NULL,
	"spouseAge" integer,
	"simulationPeriod" integer DEFAULT 50 NOT NULL,
	"returnRate" real DEFAULT 10 NOT NULL,
	"inflationRate" real DEFAULT 2 NOT NULL,
	"dividendRate" real DEFAULT 2 NOT NULL,
	"taxableBalance" real DEFAULT 100000 NOT NULL,
	"taxableCostBasis" real DEFAULT 100000 NOT NULL,
	"rothBalance" real DEFAULT 100000 NOT NULL,
	"deferredBalance" real DEFAULT 100000 NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_plan_result" (
	"id" text PRIMARY KEY NOT NULL,
	"planId" text NOT NULL,
	"year" integer NOT NULL,
	"startingTaxable" real NOT NULL,
	"startingRoth" real NOT NULL,
	"startingDeferred" real NOT NULL,
	"growthTaxable" real NOT NULL,
	"growthRoth" real NOT NULL,
	"growthDeferred" real NOT NULL,
	"contributionsTaxable" real NOT NULL,
	"contributionsRoth" real NOT NULL,
	"contributionsDeferred" real NOT NULL,
	"withdrawalsTaxable" real NOT NULL,
	"withdrawalsRoth" real NOT NULL,
	"withdrawalsDeferred" real NOT NULL,
	"federalIncomeTax" real NOT NULL,
	"californiaIncomeTax" real NOT NULL,
	"federalCapitalGainsTax" real NOT NULL,
	"californiaCapitalGainsTax" real NOT NULL,
	"federalDividendTax" real NOT NULL,
	"californiaDividendTax" real NOT NULL,
	"totalTaxes" real NOT NULL,
	"endingTaxable" real NOT NULL,
	"endingRoth" real NOT NULL,
	"endingDeferred" real NOT NULL,
	"totalPortfolioNominal" real NOT NULL,
	"totalPortfolioReal" real NOT NULL,
	"calculatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holding" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"ticker" text NOT NULL,
	"qty" real NOT NULL,
	"averageCost" real NOT NULL,
	"openedAt" integer NOT NULL,
	"schwabPositionId" text,
	"dataSource" text DEFAULT 'MANUAL' NOT NULL,
	"lastSyncAt" timestamp,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "index_member" (
	"id" text PRIMARY KEY NOT NULL,
	"indexId" text NOT NULL,
	"securityId" text NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "index" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL,
	CONSTRAINT "model_userId_name_unique" UNIQUE("userId","name")
);
--> statement-breakpoint
CREATE TABLE "model_group_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"modelId" text NOT NULL,
	"rebalancingGroupId" text NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL,
	CONSTRAINT "model_group_assignment_modelId_rebalancingGroupId_unique" UNIQUE("modelId","rebalancingGroupId")
);
--> statement-breakpoint
CREATE TABLE "model_member" (
	"id" text PRIMARY KEY NOT NULL,
	"modelId" text NOT NULL,
	"sleeveId" text NOT NULL,
	"targetWeight" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"orderId" text NOT NULL,
	"legId" integer,
	"time" timestamp NOT NULL,
	"price" real NOT NULL,
	"qty" real NOT NULL,
	"instrumentId" text,
	"fee" real,
	"raw" text,
	"settlementDate" timestamp,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebalancing_group" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rebalancing_group_member" (
	"id" text PRIMARY KEY NOT NULL,
	"groupId" text NOT NULL,
	"accountId" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "restricted_security" (
	"id" text PRIMARY KEY NOT NULL,
	"ticker" text NOT NULL,
	"sleeveId" text NOT NULL,
	"lossAmount" real NOT NULL,
	"soldAt" integer NOT NULL,
	"blockedUntil" integer NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schwab_account" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"accountNumber" text NOT NULL,
	"roundTrips" integer,
	"isDayTrader" boolean,
	"isClosingOnlyRestricted" integer,
	"pfcbFlag" boolean,
	"cashAvailableForTrading" real,
	"cashAvailableForWithdrawal" real,
	"cashCall" real,
	"longNonMarginableMarketValue" real,
	"totalCash" real,
	"cashDebitCallValue" real,
	"unsettledCash" real,
	"importedAt" timestamp NOT NULL,
	"payload" text,
	CONSTRAINT "schwab_account_accountNumber_unique" UNIQUE("accountNumber")
);
--> statement-breakpoint
CREATE TABLE "schwab_credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"encryptedAccessToken" text NOT NULL,
	"encryptedRefreshToken" text NOT NULL,
	"tokenExpiresAt" timestamp NOT NULL,
	"refreshTokenExpiresAt" integer NOT NULL,
	"schwabClientId" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schwab_holding" (
	"id" text PRIMARY KEY NOT NULL,
	"accountNumber" text NOT NULL,
	"symbol" text NOT NULL,
	"cusip" text,
	"shortQuantity" real,
	"averagePrice" real,
	"currentDayProfitLoss" real,
	"currentDayProfitLossPercentage" real,
	"longQuantity" real,
	"settledLongQuantity" real,
	"settledShortQuantity" real,
	"agedQuantity" real,
	"marketValue" real,
	"maintenanceRequirement" real,
	"averageLongPrice" real,
	"averageShortPrice" real,
	"taxLotAverageLongPrice" real,
	"taxLotAverageShortPrice" real,
	"longOpenProfitLoss" real,
	"shortOpenProfitLoss" real,
	"previousSessionLongQuantity" real,
	"previousSessionShortQuantity" real,
	"currentDayCost" real,
	"importedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schwab_security" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"cusip" text,
	"description" text,
	"lastPrice" real,
	"assetMainType" text,
	"assetSubType" text,
	"exchange" text,
	"payload" text,
	"discoveredAt" timestamp NOT NULL,
	CONSTRAINT "schwab_security_symbol_unique" UNIQUE("symbol")
);
--> statement-breakpoint
CREATE TABLE "schwab_transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"activityId" integer,
	"time" text,
	"description" text,
	"accountNumber" text NOT NULL,
	"type" text,
	"status" text,
	"subAccount" text,
	"tradeDate" text,
	"settlementDate" text,
	"positionId" integer,
	"orderId" integer,
	"netAmount" real,
	"activityType" text,
	"importedAt" timestamp NOT NULL,
	"payload" text,
	CONSTRAINT "schwab_transaction_activityId_unique" UNIQUE("activityId")
);
--> statement-breakpoint
CREATE TABLE "security" (
	"ticker" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"price" real NOT NULL,
	"marketCap" integer,
	"peRatio" real,
	"industry" text,
	"sector" text,
	"assetType" text DEFAULT 'EQUITY' NOT NULL,
	"assetTypeSub" text,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "sleeve" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL,
	CONSTRAINT "sleeve_userId_name_unique" UNIQUE("userId","name")
);
--> statement-breakpoint
CREATE TABLE "sleeve_member" (
	"id" text PRIMARY KEY NOT NULL,
	"sleeveId" text NOT NULL,
	"ticker" text NOT NULL,
	"rank" integer NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"isLegacy" boolean DEFAULT false NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_log" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"syncType" text NOT NULL,
	"status" text NOT NULL,
	"recordsProcessed" integer DEFAULT 0 NOT NULL,
	"errorMessage" text,
	"startedAt" timestamp NOT NULL,
	"completedAt" timestamp,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_log_detail" (
	"id" text PRIMARY KEY NOT NULL,
	"logId" text NOT NULL,
	"entityType" text NOT NULL,
	"entityId" text NOT NULL,
	"operation" text NOT NULL,
	"changes" text,
	"success" boolean DEFAULT true NOT NULL,
	"message" text,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_bracket" (
	"id" text PRIMARY KEY NOT NULL,
	"bracketType" text NOT NULL,
	"filingStatus" text NOT NULL,
	"minIncome" real NOT NULL,
	"maxIncome" real,
	"rate" real NOT NULL,
	"year" integer DEFAULT 2025 NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_order" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"symbol" text NOT NULL,
	"side" text NOT NULL,
	"qty" real NOT NULL,
	"type" text DEFAULT 'MARKET' NOT NULL,
	"limit" real,
	"stop" real,
	"tif" text DEFAULT 'DAY' NOT NULL,
	"session" text DEFAULT 'NORMAL' NOT NULL,
	"taxLotMethod" text,
	"specialInstruction" text,
	"quantityType" text,
	"amountIndicator" text,
	"orderStrategyType" text,
	"complexOrderStrategyType" text,
	"requestedDestination" text,
	"destinationLinkName" text,
	"previewJson" text,
	"previewOrderValue" real,
	"previewProjectedCommission" real,
	"previewWarnCount" integer DEFAULT 0 NOT NULL,
	"previewErrorCount" integer DEFAULT 0 NOT NULL,
	"previewFirstMessage" text,
	"schwabOrderId" text,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"statusDescription" text,
	"cancelable" boolean DEFAULT false NOT NULL,
	"editable" boolean DEFAULT false NOT NULL,
	"quantity" real,
	"filledQuantity" real DEFAULT 0 NOT NULL,
	"remainingQuantity" real DEFAULT 0 NOT NULL,
	"enteredAt" timestamp,
	"closeAt" timestamp,
	"cancelAt" timestamp,
	"placedAt" timestamp,
	"closedAt" timestamp,
	"cusip" text,
	"instrumentId" text,
	"replacesSchwabOrderId" text,
	"replacedBySchwabOrderId" text,
	"avgFillPrice" real,
	"lastFillPrice" real,
	"filledNotional" real,
	"realizedCommission" real,
	"realizedFeesTotal" real,
	"lastSnapshot" text,
	"idempotencyKey" text,
	"batchLabel" text,
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "trade_order_accountId_idempotencyKey_unique" UNIQUE("accountId","idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"sleeveId" text,
	"ticker" text NOT NULL,
	"type" text NOT NULL,
	"qty" real NOT NULL,
	"price" real NOT NULL,
	"realizedGainLoss" real,
	"executedAt" integer NOT NULL,
	"createdAt" integer NOT NULL,
	"updatedAt" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean,
	"name" text,
	"image" text,
	"role" text DEFAULT 'user',
	"createdAt" timestamp NOT NULL,
	"updatedAt" timestamp NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp,
	"updatedAt" timestamp
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_plan" ADD CONSTRAINT "financial_plan_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_plan_goal" ADD CONSTRAINT "financial_plan_goal_planId_financial_plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."financial_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_plan_input" ADD CONSTRAINT "financial_plan_input_planId_financial_plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."financial_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_plan_result" ADD CONSTRAINT "financial_plan_result_planId_financial_plan_id_fk" FOREIGN KEY ("planId") REFERENCES "public"."financial_plan"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_accountId_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holding" ADD CONSTRAINT "holding_ticker_security_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."security"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_member" ADD CONSTRAINT "index_member_indexId_index_id_fk" FOREIGN KEY ("indexId") REFERENCES "public"."index"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "index_member" ADD CONSTRAINT "index_member_securityId_security_ticker_fk" FOREIGN KEY ("securityId") REFERENCES "public"."security"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model" ADD CONSTRAINT "model_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_group_assignment" ADD CONSTRAINT "model_group_assignment_modelId_model_id_fk" FOREIGN KEY ("modelId") REFERENCES "public"."model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_group_assignment" ADD CONSTRAINT "model_group_assignment_rebalancingGroupId_rebalancing_group_id_fk" FOREIGN KEY ("rebalancingGroupId") REFERENCES "public"."rebalancing_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_member" ADD CONSTRAINT "model_member_modelId_model_id_fk" FOREIGN KEY ("modelId") REFERENCES "public"."model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_member" ADD CONSTRAINT "model_member_sleeveId_sleeve_id_fk" FOREIGN KEY ("sleeveId") REFERENCES "public"."sleeve"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_execution" ADD CONSTRAINT "order_execution_orderId_trade_order_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."trade_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_group" ADD CONSTRAINT "rebalancing_group_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_group_member" ADD CONSTRAINT "rebalancing_group_member_groupId_rebalancing_group_id_fk" FOREIGN KEY ("groupId") REFERENCES "public"."rebalancing_group"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rebalancing_group_member" ADD CONSTRAINT "rebalancing_group_member_accountId_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_security" ADD CONSTRAINT "restricted_security_ticker_security_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."security"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "restricted_security" ADD CONSTRAINT "restricted_security_sleeveId_sleeve_id_fk" FOREIGN KEY ("sleeveId") REFERENCES "public"."sleeve"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schwab_credentials" ADD CONSTRAINT "schwab_credentials_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleeve" ADD CONSTRAINT "sleeve_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleeve_member" ADD CONSTRAINT "sleeve_member_sleeveId_sleeve_id_fk" FOREIGN KEY ("sleeveId") REFERENCES "public"."sleeve"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleeve_member" ADD CONSTRAINT "sleeve_member_ticker_security_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."security"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_log" ADD CONSTRAINT "sync_log_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_log_detail" ADD CONSTRAINT "sync_log_detail_logId_sync_log_id_fk" FOREIGN KEY ("logId") REFERENCES "public"."sync_log"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_order" ADD CONSTRAINT "trade_order_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_order" ADD CONSTRAINT "trade_order_accountId_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_accountId_account_id_fk" FOREIGN KEY ("accountId") REFERENCES "public"."account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_sleeveId_sleeve_id_fk" FOREIGN KEY ("sleeveId") REFERENCES "public"."sleeve"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_ticker_security_ticker_fk" FOREIGN KEY ("ticker") REFERENCES "public"."security"("ticker") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_order_execution_order_time" ON "order_execution" USING btree ("orderId","time");--> statement-breakpoint
CREATE INDEX "idx_schwab_account_type" ON "schwab_account" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_schwab_holding_account_symbol" ON "schwab_holding" USING btree ("accountNumber","symbol");--> statement-breakpoint
CREATE INDEX "idx_schwab_security_cusip" ON "schwab_security" USING btree ("cusip");--> statement-breakpoint
CREATE INDEX "idx_schwab_security_discoveredAt" ON "schwab_security" USING btree ("discoveredAt");--> statement-breakpoint
CREATE INDEX "idx_schwab_transaction_accountNumber" ON "schwab_transaction" USING btree ("accountNumber");--> statement-breakpoint
CREATE INDEX "idx_schwab_transaction_time" ON "schwab_transaction" USING btree ("time");--> statement-breakpoint
CREATE INDEX "idx_schwab_transaction_type" ON "schwab_transaction" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_trade_order_user_account_status" ON "trade_order" USING btree ("userId","accountId","status");--> statement-breakpoint
CREATE INDEX "idx_trade_order_account_schwab" ON "trade_order" USING btree ("accountId","schwabOrderId");