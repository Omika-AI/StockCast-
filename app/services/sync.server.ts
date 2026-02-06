import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import db from "../db.server";
import { backfillSalesHistory } from "./sales-history.server";

const MAX_BACKFILL_DAYS = 180;

export async function ensureShopRecord(shopDomain: string) {
  return db.shop.upsert({
    where: { shopDomain },
    update: {},
    create: { shopDomain },
  });
}

export async function syncSalesData(
  admin: AdminApiContext,
  shopDomain: string,
  daysBack?: number
): Promise<void> {
  const shop = await ensureShopRecord(shopDomain);
  await backfillSalesHistory(admin, shop.id, daysBack || MAX_BACKFILL_DAYS);
}

export async function getShopSettings(shopDomain: string) {
  return ensureShopRecord(shopDomain);
}

export async function getProductSettings(shopId: string, shopifyProductId: string) {
  return db.productSettings.findUnique({
    where: {
      shopId_shopifyProductId: {
        shopId,
        shopifyProductId,
      },
    },
  });
}

export async function getIncomingStock(shopId: string, shopifyProductId: string) {
  return db.incomingStock.findMany({
    where: {
      shopId,
      shopifyProductId,
      expectedDate: { gte: new Date() },
    },
    orderBy: { expectedDate: "asc" },
  });
}

export async function hasSalesData(shopId: string): Promise<boolean> {
  const count = await db.salesSnapshot.count({
    where: { shopId },
  });
  return count > 0;
}
