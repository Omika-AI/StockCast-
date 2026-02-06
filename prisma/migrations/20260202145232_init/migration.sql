-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopDomain" TEXT NOT NULL,
    "leadTimeDays" INTEGER NOT NULL DEFAULT 84,
    "saleRangeDays" INTEGER NOT NULL DEFAULT 90,
    "monthlyGrowthRate" REAL NOT NULL DEFAULT 1.10,
    "alertThreshold" INTEGER NOT NULL DEFAULT 14,
    "billingStatus" TEXT NOT NULL DEFAULT 'free',
    "billingPlan" TEXT,
    "chargeId" TEXT,
    "trialEndsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProductSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "leadTimeDays" INTEGER,
    "saleRangeDays" INTEGER,
    "monthlyGrowthRate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "IncomingStock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "expectedDate" DATETIME NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "SalesSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopDomain_key" ON "Shop"("shopDomain");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSettings_shopId_shopifyProductId_key" ON "ProductSettings"("shopId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "IncomingStock_shopId_shopifyProductId_idx" ON "IncomingStock"("shopId", "shopifyProductId");

-- CreateIndex
CREATE INDEX "SalesSnapshot_shopId_shopifyProductId_idx" ON "SalesSnapshot"("shopId", "shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesSnapshot_shopId_shopifyProductId_date_key" ON "SalesSnapshot"("shopId", "shopifyProductId", "date");
