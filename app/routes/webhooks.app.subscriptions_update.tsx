import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ensureShopRecord } from "../services/sync.server";
import { updateBillingStatus } from "../services/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  try {
    await ensureShopRecord(shop);
    const subscriptionData = payload as any;
    const status = subscriptionData.app_subscription?.status;

    if (status === "ACTIVE") {
      await updateBillingStatus(shop, "active");
    } else if (status === "CANCELLED" || status === "DECLINED" || status === "EXPIRED") {
      await updateBillingStatus(shop, "free");
    } else if (status === "PENDING") {
      await updateBillingStatus(shop, "pending");
    }
  } catch (error) {
    console.error("Error processing subscription webhook:", error);
  }

  return new Response();
};
