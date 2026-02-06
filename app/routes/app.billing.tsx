import {
  json,
  redirect,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Badge,
  List,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { ensureShopRecord } from "../services/sync.server";
import {
  createSubscription,
  checkActiveSubscription,
  getBillingStatus,
} from "../services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  await ensureShopRecord(shopDomain);

  const isActive = await checkActiveSubscription(admin, shopDomain);
  const billing = await getBillingStatus(shopDomain);

  return json({
    billing,
    isActive,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const url = new URL(request.url);
  const returnUrl = `${url.origin}/app/billing`;

  const confirmationUrl = await createSubscription(
    admin,
    shopDomain,
    returnUrl
  );

  if (confirmationUrl) {
    return redirect(confirmationUrl);
  }

  return json({ error: "Failed to create subscription" });
};

export default function Billing() {
  const { billing, isActive } = useLoaderData<typeof loader>();

  return (
    <Page title="Billing" backAction={{ url: "/app" }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingLg">
                  StockCast Pro
                </Text>
                <Badge tone={isActive ? "success" : "info"}>
                  {isActive ? "Active" : "Not subscribed"}
                </Badge>
              </InlineStack>

              <Text as="p" variant="headingXl">
                $9.99
                <Text as="span" variant="bodySm" tone="subdued">
                  {" "}
                  / month
                </Text>
              </Text>

              <Divider />

              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Includes:
                </Text>
                <List>
                  <List.Item>
                    Stock-out predictions for unlimited products
                  </List.Item>
                  <List.Item>
                    Day-by-day inventory projection charts
                  </List.Item>
                  <List.Item>
                    Configurable growth rate and lead time
                  </List.Item>
                  <List.Item>
                    Incoming stock tracking with multiple deliveries
                  </List.Item>
                  <List.Item>
                    Real-time reorder alerts
                  </List.Item>
                  <List.Item>
                    7-day free trial
                  </List.Item>
                </List>
              </BlockStack>

              {!isActive && (
                <Form method="post">
                  <Button submit variant="primary" size="large" fullWidth>
                    Start Free Trial
                  </Button>
                </Form>
              )}

              {isActive && (
                <Banner tone="success">
                  <p>
                    Your subscription is active. You have full access to all
                    StockCast features.
                  </p>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h3" variant="headingSm">
                Current Plan
              </Text>
              <Text as="p" variant="bodyMd">
                <strong>Status:</strong>{" "}
                {billing.status === "active"
                  ? "Active"
                  : billing.status === "pending"
                    ? "Pending"
                    : "Free"}
              </Text>
              {billing.plan && (
                <Text as="p" variant="bodyMd">
                  <strong>Plan:</strong> {billing.plan}
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
