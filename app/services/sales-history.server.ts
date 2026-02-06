import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import db from "../db.server";

const ORDERS_QUERY = `#graphql
  query getOrders($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      edges {
        cursor
        node {
          id
          createdAt
          lineItems(first: 100) {
            edges {
              node {
                product {
                  id
                }
                quantity
              }
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export async function backfillSalesHistory(
  admin: AdminApiContext,
  shopId: string,
  daysBack: number = 90
): Promise<void> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - daysBack);
  const sinceStr = sinceDate.toISOString();

  let hasNextPage = true;
  let afterCursor: string | null = null;
  const salesMap = new Map<string, number>();

  while (hasNextPage) {
    const response = await admin.graphql(ORDERS_QUERY, {
      variables: {
        first: 50,
        after: afterCursor,
        query: `created_at:>='${sinceStr}'`,
      },
    });

    const data = await response.json();
    const edges = data.data?.orders?.edges || [];
    const pageInfo = data.data?.orders?.pageInfo;

    for (const edge of edges) {
      const order = edge.node;
      const orderDate = new Date(order.createdAt);
      const dateStr = orderDate.toISOString().split("T")[0];

      for (const lineEdge of order.lineItems?.edges || []) {
        const productId = lineEdge.node.product?.id;
        const quantity = lineEdge.node.quantity || 0;

        if (productId) {
          const key = `${productId}|${dateStr}`;
          salesMap.set(key, (salesMap.get(key) || 0) + quantity);
        }
      }
    }

    hasNextPage = pageInfo?.hasNextPage || false;
    afterCursor = pageInfo?.endCursor || null;
  }

  for (const [key, quantity] of salesMap) {
    const [productId, dateStr] = key.split("|");
    const date = new Date(dateStr + "T00:00:00.000Z");

    await db.salesSnapshot.upsert({
      where: {
        shopId_shopifyProductId_date: {
          shopId,
          shopifyProductId: productId,
          date,
        },
      },
      update: { quantity },
      create: {
        shopId,
        shopifyProductId: productId,
        date,
        quantity,
      },
    });
  }
}

export async function getAvgDailySales(
  shopId: string,
  shopifyProductId: string,
  saleRangeDays: number = 90
): Promise<number> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - saleRangeDays);

  const snapshots = await db.salesSnapshot.findMany({
    where: {
      shopId,
      shopifyProductId,
      date: { gte: sinceDate },
    },
  });

  if (snapshots.length === 0) return 0;

  const totalSales = snapshots.reduce((sum, s) => sum + s.quantity, 0);

  const dates = snapshots.map((s) => s.date.getTime());
  const earliestSale = new Date(Math.min(...dates));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const actualDays = Math.max(
    1,
    Math.ceil((today.getTime() - earliestSale.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const effectiveDays = Math.min(saleRangeDays, actualDays);

  return totalSales / effectiveDays;
}

export async function upsertSalesFromOrder(
  shopId: string,
  orderData: {
    createdAt: string;
    lineItems: { productId: string; quantity: number }[];
  }
): Promise<void> {
  const orderDate = new Date(orderData.createdAt);
  const date = new Date(orderDate.toISOString().split("T")[0] + "T00:00:00.000Z");

  for (const item of orderData.lineItems) {
    if (!item.productId) continue;

    const existing = await db.salesSnapshot.findUnique({
      where: {
        shopId_shopifyProductId_date: {
          shopId,
          shopifyProductId: item.productId,
          date,
        },
      },
    });

    await db.salesSnapshot.upsert({
      where: {
        shopId_shopifyProductId_date: {
          shopId,
          shopifyProductId: item.productId,
          date,
        },
      },
      update: { quantity: (existing?.quantity || 0) + item.quantity },
      create: {
        shopId,
        shopifyProductId: item.productId,
        date,
        quantity: item.quantity,
      },
    });
  }
}
