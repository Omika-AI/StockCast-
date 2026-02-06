import {
  json,
  type LoaderFunctionArgs,
  type ActionFunctionArgs,
} from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation } from "@remix-run/react";
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
import { authenticate } from "../shopify.server";
import { fetchProduct } from "../services/inventory.server";
import { getAvgDailySales } from "../services/sales-history.server";
import { runProjection } from "../services/projection.server";
import {
  ensureShopRecord,
  getProductSettings,
  getIncomingStock,
} from "../services/sync.server";
import db from "../db.server";
import { RiskBadge } from "../components/RiskBadge";
import { ProjectionChart } from "../components/ProjectionChart";
import { IncomingStockForm } from "../components/IncomingStockForm";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const productId = `gid://shopify/Product/${params.id}`;

  const shop = await ensureShopRecord(shopDomain);
  const product = await fetchProduct(admin, productId);

  if (!product) {
    throw new Response("Product not found", { status: 404 });
  }

  const productSettings = await getProductSettings(shop.id, product.id);
  const incomingStockEntries = await getIncomingStock(shop.id, product.id);

  const saleRange = productSettings?.saleRangeDays ?? shop.saleRangeDays;
  const growthRate =
    productSettings?.monthlyGrowthRate ?? shop.monthlyGrowthRate;
  const leadTime = productSettings?.leadTimeDays ?? shop.leadTimeDays;

  const avgDailySales = await getAvgDailySales(
    shop.id,
    product.id,
    saleRange
  );

  const projection = runProjection({
    currentInventory: product.totalInventory,
    avgDailySales,
    monthlyGrowthRate: growthRate,
    leadTimeDays: leadTime,
    incomingStock: incomingStockEntries.map((s) => ({
      date: s.expectedDate,
      quantity: s.quantity,
    })),
  });

  return json({
    product,
    projection,
    avgDailySales,
    settings: {
      saleRange,
      growthRate,
      leadTime,
    },
    shopDefaults: {
      saleRangeDays: shop.saleRangeDays,
      monthlyGrowthRate: shop.monthlyGrowthRate,
      leadTimeDays: shop.leadTimeDays,
    },
    productSettings: productSettings
      ? {
          saleRangeDays: productSettings.saleRangeDays,
          monthlyGrowthRate: productSettings.monthlyGrowthRate,
          leadTimeDays: productSettings.leadTimeDays,
        }
      : null,
    incomingStock: incomingStockEntries.map((s) => ({
      id: s.id,
      quantity: s.quantity,
      expectedDate: s.expectedDate.toISOString().split("T")[0],
      note: s.note,
    })),
    shopId: shop.id,
  });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopDomain = session.shop;
  const productId = `gid://shopify/Product/${params.id}`;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  const shop = await ensureShopRecord(shopDomain);

  if (intent === "updateSettings") {
    const leadTimeDays = formData.get("leadTimeDays");
    const saleRangeDays = formData.get("saleRangeDays");
    const monthlyGrowthRate = formData.get("monthlyGrowthRate");

    await db.productSettings.upsert({
      where: {
        shopId_shopifyProductId: {
          shopId: shop.id,
          shopifyProductId: productId,
        },
      },
      update: {
        leadTimeDays: leadTimeDays ? parseInt(leadTimeDays as string) : null,
        saleRangeDays: saleRangeDays
          ? parseInt(saleRangeDays as string)
          : null,
        monthlyGrowthRate: monthlyGrowthRate
          ? parseFloat(monthlyGrowthRate as string)
          : null,
      },
      create: {
        shopId: shop.id,
        shopifyProductId: productId,
        leadTimeDays: leadTimeDays ? parseInt(leadTimeDays as string) : null,
        saleRangeDays: saleRangeDays
          ? parseInt(saleRangeDays as string)
          : null,
        monthlyGrowthRate: monthlyGrowthRate
          ? parseFloat(monthlyGrowthRate as string)
          : null,
      },
    });

    return json({ success: true, message: "Product settings updated" });
  }

  if (intent === "addIncomingStock") {
    const quantity = parseInt(formData.get("quantity") as string);
    const expectedDate = formData.get("expectedDate") as string;
    const note = (formData.get("note") as string) || null;

    await db.incomingStock.create({
      data: {
        shopId: shop.id,
        shopifyProductId: productId,
        quantity,
        expectedDate: new Date(expectedDate + "T00:00:00.000Z"),
        note,
      },
    });

    return json({ success: true, message: "Incoming stock added" });
  }

  if (intent === "deleteIncomingStock") {
    const entryId = formData.get("entryId") as string;
    await db.incomingStock.delete({ where: { id: entryId } });
    return json({ success: true, message: "Incoming stock removed" });
  }

  return json({ success: false, message: "Unknown action" });
};

export default function ProductDetail() {
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
    productSettings?.leadTimeDays?.toString() || ""
  );
  const [saleRange, setSaleRange] = useState(
    productSettings?.saleRangeDays?.toString() || ""
  );
  const [growthRate, setGrowthRate] = useState(
    productSettings?.monthlyGrowthRate?.toString() || ""
  );

  const projectionTableRows = projection.dailyProjection
    .filter((_, i) => i % 7 === 0 || i === projection.dailyProjection.length - 1)
    .slice(0, 53)
    .map((day) => [
      day.date,
      day.inventory.toLocaleString(),
      day.incomingStock > 0 ? `+${day.incomingStock.toLocaleString()}` : "-",
      day.dailySales.toFixed(1),
    ]);

  return (
    <Page
      backAction={{ url: "/app" }}
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
                  { month: "long", day: "numeric", year: "numeric" }
                )}
              </strong>{" "}
              to avoid stock-out
              {projection.stockOutDate &&
                ` on ${new Date(projection.stockOutDate).toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" }
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
