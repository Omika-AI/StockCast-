import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Select,
  Button,
  Banner,
} from "@shopify/polaris";
import { useState, useMemo } from "react";
import { authenticate } from "../shopify.server";
import { fetchAllProducts } from "../services/inventory.server";
import { getAvgDailySales } from "../services/sales-history.server";
import { runProjection } from "../services/projection.server";
import {
  ensureShopRecord,
  getProductSettings,
  getIncomingStock,
  hasSalesData,
  syncSalesData,
} from "../services/sync.server";
import { ProductTable, type ProductRow } from "../components/ProductTable";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopDomain = session.shop;

  const shop = await ensureShopRecord(shopDomain);
  const hasSales = await hasSalesData(shop.id);

  if (!hasSales) {
    try {
      await syncSalesData(admin, shopDomain);
    } catch (e) {
      console.error("Failed to sync sales data:", e);
    }
  }

  const products = await fetchAllProducts(admin);

  const productRows: ProductRow[] = await Promise.all(
    products.map(async (product) => {
      const productSettings = await getProductSettings(shop.id, product.id);
      const incomingStock = await getIncomingStock(shop.id, product.id);

      const saleRange =
        productSettings?.saleRangeDays ?? shop.saleRangeDays;
      const growthRate =
        productSettings?.monthlyGrowthRate ?? shop.monthlyGrowthRate;
      const leadTime =
        productSettings?.leadTimeDays ?? shop.leadTimeDays;

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
        incomingStock: incomingStock.map((s) => ({
          date: s.expectedDate,
          quantity: s.quantity,
        })),
      });

      return {
        id: product.id,
        title: product.title,
        vendor: product.vendor,
        totalInventory: product.totalInventory,
        avgDailySales,
        daysUntilStockOut: projection.daysUntilStockOut,
        stockOutDate: projection.stockOutDate,
        mustReorderBy: projection.mustReorderBy,
        reorderUrgency: projection.reorderUrgency,
      };
    })
  );

  productRows.sort((a, b) => {
    const urgencyOrder = { critical: 0, warning: 1, ok: 2 };
    const diff =
      urgencyOrder[a.reorderUrgency] - urgencyOrder[b.reorderUrgency];
    if (diff !== 0) return diff;
    return (a.daysUntilStockOut ?? 999) - (b.daysUntilStockOut ?? 999);
  });

  const vendors = [
    ...new Set(products.map((p) => p.vendor).filter(Boolean)),
  ].sort();

  return json({
    products: productRows,
    vendors,
    shopDomain,
  });
};

export default function Dashboard() {
  const { products, vendors } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [vendorFilter, setVendorFilter] = useState("");

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = searchQuery
        ? p.title.toLowerCase().includes(searchQuery.toLowerCase())
        : true;
      const matchesVendor = vendorFilter ? p.vendor === vendorFilter : true;
      return matchesSearch && matchesVendor;
    });
  }, [products, searchQuery, vendorFilter]);

  const criticalCount = products.filter(
    (p) => p.reorderUrgency === "critical"
  ).length;
  const warningCount = products.filter(
    (p) => p.reorderUrgency === "warning"
  ).length;
  const atRiskCount = criticalCount + warningCount;

  const vendorOptions = [
    { label: "All Brands", value: "" },
    ...vendors.map((v) => ({ label: v, value: v })),
  ];

  return (
    <Page title="StockCast Dashboard">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="subdued">
                  Products at Risk
                </Text>
                <Text as="p" variant="headingXl">
                  {atRiskCount}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="critical">
                  Critical
                </Text>
                <Text as="p" variant="headingXl" tone="critical">
                  {criticalCount}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm" tone="caution">
                  Reorder Soon
                </Text>
                <Text as="p" variant="headingXl" tone="caution">
                  {warningCount}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card>
          <BlockStack gap="400">
            <InlineStack gap="400" align="start" blockAlign="end">
              <div style={{ flexGrow: 1, maxWidth: 400 }}>
                <TextField
                  label="Search products"
                  value={searchQuery}
                  onChange={setSearchQuery}
                  autoComplete="off"
                  placeholder="Search by product name..."
                  clearButton
                  onClearButtonClick={() => setSearchQuery("")}
                />
              </div>
              <div style={{ minWidth: 200 }}>
                <Select
                  label="Brand"
                  options={vendorOptions}
                  value={vendorFilter}
                  onChange={setVendorFilter}
                />
              </div>
              <Button onClick={() => navigate(".", { replace: true })}>
                Sync Now
              </Button>
            </InlineStack>

            {filteredProducts.length === 0 ? (
              <Banner tone="info">
                <p>
                  {products.length === 0
                    ? "No products found. Make sure your store has products with inventory tracking enabled."
                    : "No products match your search criteria."}
                </p>
              </Banner>
            ) : (
              <ProductTable products={filteredProducts} />
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
