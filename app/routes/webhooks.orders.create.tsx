import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { upsertSalesFromOrder } from "../services/sales-history.server";
import { ensureShopRecord } from "../services/sync.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    const shopRecord = await ensureShopRecord(shop);
    const orderData = payload as any;

    const lineItems = (orderData.line_items || []).map((item: any) => ({
      productId: item.product_id
        ? `gid://shopify/Product/${item.product_id}`
        : null,
      quantity: item.quantity || 0,
    })).filter((item: any) => item.productId);

    await upsertSalesFromOrder(shopRecord.id, {
      createdAt: orderData.created_at || new Date().toISOString(),
      lineItems,
    });
  } catch (error) {
    console.error("Error processing orders/create webhook:", error);
  }

  return new Response();
};
