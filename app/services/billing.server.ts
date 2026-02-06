import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import db from "../db.server";

const PLAN_NAME = "StockCast Pro";
const PLAN_AMOUNT = 9.99;
const TRIAL_DAYS = 7;

const CREATE_SUBSCRIPTION_MUTATION = `#graphql
  mutation createSubscription($name: String!, $returnUrl: URL!, $amount: Decimal!, $trialDays: Int!, $currencyCode: CurrencyCode!) {
    appSubscriptionCreate(
      name: $name
      returnUrl: $returnUrl
      trialDays: $trialDays
      lineItems: [
        {
          plan: {
            appRecurringPricingDetails: {
              price: { amount: $amount, currencyCode: $currencyCode }
            }
          }
        }
      ]
    ) {
      appSubscription {
        id
        status
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

const ACTIVE_SUBSCRIPTIONS_QUERY = `#graphql
  query {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        trialDays
        currentPeriodEnd
        test
      }
    }
  }
`;

export async function createSubscription(
  admin: AdminApiContext,
  shopDomain: string,
  returnUrl: string
): Promise<string | null> {
  const response = await admin.graphql(CREATE_SUBSCRIPTION_MUTATION, {
    variables: {
      name: PLAN_NAME,
      returnUrl,
      amount: PLAN_AMOUNT,
      trialDays: TRIAL_DAYS,
      currencyCode: "USD",
    },
  });

  const data = await response.json();
  const result = data.data?.appSubscriptionCreate;

  if (result?.userErrors?.length > 0) {
    console.error("Billing error:", result.userErrors);
    return null;
  }

  if (result?.appSubscription?.id) {
    await db.shop.update({
      where: { shopDomain },
      data: {
        chargeId: result.appSubscription.id,
        billingStatus: "pending",
        billingPlan: PLAN_NAME,
      },
    });
  }

  return result?.confirmationUrl || null;
}

export async function checkActiveSubscription(
  admin: AdminApiContext,
  shopDomain: string
): Promise<boolean> {
  const response = await admin.graphql(ACTIVE_SUBSCRIPTIONS_QUERY);
  const data = await response.json();
  const subscriptions =
    data.data?.currentAppInstallation?.activeSubscriptions || [];

  const active = subscriptions.find(
    (sub: any) => sub.name === PLAN_NAME && sub.status === "ACTIVE"
  );

  if (active) {
    await db.shop.update({
      where: { shopDomain },
      data: {
        billingStatus: "active",
        chargeId: active.id,
        billingPlan: PLAN_NAME,
      },
    });
    return true;
  }

  const shop = await db.shop.findUnique({ where: { shopDomain } });
  if (shop?.billingStatus === "active") {
    await db.shop.update({
      where: { shopDomain },
      data: { billingStatus: "free" },
    });
  }

  return false;
}

export async function getBillingStatus(shopDomain: string) {
  const shop = await db.shop.findUnique({ where: { shopDomain } });
  return {
    status: shop?.billingStatus || "free",
    plan: shop?.billingPlan || null,
    chargeId: shop?.chargeId || null,
  };
}

export async function updateBillingStatus(
  shopDomain: string,
  status: string
): Promise<void> {
  await db.shop.update({
    where: { shopDomain },
    data: { billingStatus: status },
  });
}
