import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  // Clean up all shop data when the shop requests redaction
  const shopRecord = await db.shop.findUnique({ where: { shopDomain: shop } });
  if (shopRecord) {
    await db.salesSnapshot.deleteMany({ where: { shopId: shopRecord.id } });
    await db.incomingStock.deleteMany({ where: { shopId: shopRecord.id } });
    await db.productSettings.deleteMany({ where: { shopId: shopRecord.id } });
    await db.shop.delete({ where: { id: shopRecord.id } });
  }

  return new Response();
};
