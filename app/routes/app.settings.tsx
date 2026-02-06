import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useNavigation, Form } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
} from "@shopify/polaris";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import { ensureShopRecord } from "../services/sync.server";
import db from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord(session.shop);

  return json({
    settings: {
      leadTimeDays: shop.leadTimeDays,
      saleRangeDays: shop.saleRangeDays,
      monthlyGrowthRate: shop.monthlyGrowthRate,
      alertThreshold: shop.alertThreshold,
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await ensureShopRecord(session.shop);
  const formData = await request.formData();

  const leadTimeDays = parseInt(formData.get("leadTimeDays") as string) || 84;
  const saleRangeDays =
    parseInt(formData.get("saleRangeDays") as string) || 90;
  const monthlyGrowthRate =
    parseFloat(formData.get("monthlyGrowthRate") as string) || 1.1;
  const alertThreshold =
    parseInt(formData.get("alertThreshold") as string) || 14;

  await db.shop.update({
    where: { id: shop.id },
    data: {
      leadTimeDays,
      saleRangeDays,
      monthlyGrowthRate,
      alertThreshold,
    },
  });

  return json({ success: true });
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [leadTimeWeeks, setLeadTimeWeeks] = useState(
    Math.round(settings.leadTimeDays / 7).toString()
  );
  const [saleRange, setSaleRange] = useState(
    settings.saleRangeDays.toString()
  );
  const [growthRate, setGrowthRate] = useState(
    settings.monthlyGrowthRate.toString()
  );
  const [alertThreshold, setAlertThreshold] = useState(
    settings.alertThreshold.toString()
  );

  const saleRangeOptions = [
    { label: "30 days", value: "30" },
    { label: "60 days", value: "60" },
    { label: "90 days", value: "90" },
    { label: "120 days", value: "120" },
    { label: "180 days", value: "180" },
  ];

  return (
    <Page title="Settings" backAction={{ url: "/app" }}>
      <Layout>
        <Layout.AnnotatedSection
          title="Projection Defaults"
          description="These defaults apply to all products unless overridden at the product level."
        >
          <Card>
            <Form method="post">
              <input
                type="hidden"
                name="leadTimeDays"
                value={parseInt(leadTimeWeeks) * 7 || 84}
              />
              <input
                type="hidden"
                name="saleRangeDays"
                value={saleRange}
              />
              <FormLayout>
                <TextField
                  label="Lead Time (weeks)"
                  type="number"
                  value={leadTimeWeeks}
                  onChange={setLeadTimeWeeks}
                  autoComplete="off"
                  helpText={`${parseInt(leadTimeWeeks) * 7 || 0} days. Time from placing a reorder to receiving stock.`}
                  min="1"
                />
                <Select
                  label="Sale Range"
                  options={saleRangeOptions}
                  value={saleRange}
                  onChange={setSaleRange}
                  helpText="Number of historical days used to calculate average daily sales."
                />
                <TextField
                  label="Monthly Growth Rate"
                  type="number"
                  name="monthlyGrowthRate"
                  value={growthRate}
                  onChange={setGrowthRate}
                  autoComplete="off"
                  step="0.01"
                  helpText="Multiplier for monthly sales growth. 1.00 = flat, 1.10 = 10% growth/month."
                />
                <TextField
                  label="Alert Threshold (days)"
                  type="number"
                  name="alertThreshold"
                  value={alertThreshold}
                  onChange={setAlertThreshold}
                  autoComplete="off"
                  helpText="Show warning when reorder date is within this many days."
                />
                <Button submit variant="primary" loading={isSubmitting}>
                  Save Settings
                </Button>
              </FormLayout>
            </Form>
          </Card>
        </Layout.AnnotatedSection>

        <Layout.AnnotatedSection
          title="How It Works"
          description="Understanding the projection model"
        >
          <Card>
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                StockCast uses your sales history to project future inventory levels:
              </Text>
              <Text as="p" variant="bodySm">
                1. <strong>Average Daily Sales</strong> is calculated from your
                order history over the configured sale range.
              </Text>
              <Text as="p" variant="bodySm">
                2. <strong>Daily Growth Rate</strong> is derived from the monthly
                rate: dailyGrowth = monthlyGrowth^(1/30).
              </Text>
              <Text as="p" variant="bodySm">
                3. Each day, inventory decreases by the growing daily sales
                figure, and any incoming stock is added.
              </Text>
              <Text as="p" variant="bodySm">
                4. The <strong>stock-out date</strong> is when projected inventory
                first hits zero.
              </Text>
              <Text as="p" variant="bodySm">
                5. <strong>Must reorder by</strong> = stock-out date minus lead
                time.
              </Text>
            </BlockStack>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>
    </Page>
  );
}
