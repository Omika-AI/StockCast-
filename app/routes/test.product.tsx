import { json, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  FormLayout,
  TextField,
  Button,
  DataTable,
  Banner,
  Divider,
} from "@shopify/polaris";
import { useState } from "react";
import { useFetcher } from "@remix-run/react";
import { runProjection } from "../services/projection.server";
import { RiskBadge } from "../components/RiskBadge";
import { ProjectionChart } from "../components/ProjectionChart";
import { IncomingStockForm } from "../components/IncomingStockForm";

const MOCK_PRODUCT = {
  id: "gid://shopify/Product/1001",
  title: "CanaCare Grow Formula",
  vendor: "CanaCare",
  totalInventory: 25000,
};

const MOCK_AVG_DAILY_SALES = 170;
const MOCK_GROWTH_RATE = 1.1;
const MOCK_LEAD_TIME = 84;

function getIncomingStockDate(daysFromNow: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

const MOCK_INCOMING_STOCK = [
  { date: getIncomingStockDate(30), quantity: 5000 },
];

const MOCK_INCOMING_ENTRIES = [
  {
    id: "incoming-1",
    quantity: 5000,
    expectedDate: getIncomingStockDate(30).toISOString().split("T")[0],
    note: "PO #1234",
  },
];

export const loader = async () => {
  const projection = runProjection({
    currentInventory: MOCK_PRODUCT.totalInventory,
    avgDailySales: MOCK_AVG_DAILY_SALES,
    monthlyGrowthRate: MOCK_GROWTH_RATE,
    leadTimeDays: MOCK_LEAD_TIME,
    incomingStock: MOCK_INCOMING_STOCK,
  });

  return json({
    product: MOCK_PRODUCT,
    projection,
    avgDailySales: MOCK_AVG_DAILY_SALES,
    settings: {
      saleRange: 90,
      growthRate: MOCK_GROWTH_RATE,
      leadTime: MOCK_LEAD_TIME,
    },
    shopDefaults: {
      saleRangeDays: 90,
      monthlyGrowthRate: MOCK_GROWTH_RATE,
      leadTimeDays: MOCK_LEAD_TIME,
    },
    productSettings: null,
    incomingStock: MOCK_INCOMING_ENTRIES,
    shopId: "test-shop-id",
  });
};

// No-op action so form submissions don't 405
export const action = async ({ request }: ActionFunctionArgs) => {
  return json({ success: true, message: "Test mode — no persistence" });
};

export default function TestProductDetail() {
  const {
    product,
    projection,
    avgDailySales,
    settings,
    shopDefaults,
    productSettings,
    incomingStock,
  } = useLoaderData<typeof loader>();

  const fetcher = useFetcher();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [leadTime, setLeadTime] = useState(
    productSettings?.leadTimeDays?.toString() || "",
  );
  const [saleRange, setSaleRange] = useState(
    productSettings?.saleRangeDays?.toString() || "",
  );
  const [growthRate, setGrowthRate] = useState(
    productSettings?.monthlyGrowthRate?.toString() || "",
  );

  const projectionTableRows = projection.dailyProjection
    .filter(
      (_, i) => i % 7 === 0 || i === projection.dailyProjection.length - 1,
    )
    .slice(0, 53)
    .map((day) => [
      day.date,
      day.inventory.toLocaleString(),
      day.incomingStock > 0 ? `+${day.incomingStock.toLocaleString()}` : "-",
      day.dailySales.toFixed(1),
    ]);

  return (
    <Page
      backAction={{ url: "/test" }}
      title={product.title}
      subtitle={`${product.vendor || "No brand"} | Current Stock: ${product.totalInventory.toLocaleString()}`}
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Current Inventory
                </Text>
                <Text as="p" variant="headingXl">
                  {product.totalInventory.toLocaleString()}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Avg Daily Sales
                </Text>
                <Text as="p" variant="headingXl">
                  {avgDailySales.toFixed(1)}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Days Until Stock-Out
                </Text>
                <InlineStack gap="200" blockAlign="center">
                  <Text as="p" variant="headingXl">
                    {projection.daysUntilStockOut !== null
                      ? projection.daysUntilStockOut
                      : "365+"}
                  </Text>
                  <RiskBadge
                    urgency={projection.reorderUrgency}
                    daysUntilStockOut={projection.daysUntilStockOut}
                  />
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {projection.mustReorderBy && (
          <Banner
            tone={
              projection.reorderUrgency === "critical" ? "critical" : "warning"
            }
            title={
              projection.reorderUrgency === "critical"
                ? "Reorder immediately!"
                : "Reorder soon"
            }
          >
            <p>
              Must reorder by{" "}
              <strong>
                {new Date(projection.mustReorderBy).toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" },
                )}
              </strong>{" "}
              to avoid stock-out
              {projection.stockOutDate &&
                ` on ${new Date(projection.stockOutDate).toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" },
                )}`}
              .
            </p>
          </Banner>
        )}

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Inventory Projection
            </Text>
            <ProjectionChart
              data={projection.dailyProjection}
              stockOutDate={projection.stockOutDate}
              mustReorderBy={projection.mustReorderBy}
            />
          </BlockStack>
        </Card>

        <Layout>
          <Layout.Section>
            <IncomingStockForm
              productId={product.id}
              entries={incomingStock}
            />
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Product Settings Override
                </Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Leave blank to use global defaults
                </Text>
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="updateSettings" />
                  <FormLayout>
                    <TextField
                      label={`Lead Time (days) [default: ${shopDefaults.leadTimeDays}]`}
                      type="number"
                      value={leadTime}
                      onChange={setLeadTime}
                      autoComplete="off"
                      placeholder={shopDefaults.leadTimeDays.toString()}
                    />
                    <TextField
                      label={`Sale Range (days) [default: ${shopDefaults.saleRangeDays}]`}
                      type="number"
                      value={saleRange}
                      onChange={setSaleRange}
                      autoComplete="off"
                      placeholder={shopDefaults.saleRangeDays.toString()}
                    />
                    <TextField
                      label={`Monthly Growth Rate [default: ${shopDefaults.monthlyGrowthRate}]`}
                      type="number"
                      value={growthRate}
                      onChange={setGrowthRate}
                      autoComplete="off"
                      step="0.01"
                      placeholder={shopDefaults.monthlyGrowthRate.toString()}
                    />
                    <Button submit variant="primary" loading={isSubmitting}>
                      Save Overrides
                    </Button>
                  </FormLayout>
                </fetcher.Form>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Weekly Projection Table
            </Text>
            <DataTable
              columnContentTypes={["text", "numeric", "numeric", "numeric"]}
              headings={["Date", "Inventory", "Incoming Stock", "Daily Sales"]}
              rows={projectionTableRows}
            />
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
