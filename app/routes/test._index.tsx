import { json } from "@remix-run/node";
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
  Banner,
} from "@shopify/polaris";
import { useState, useMemo } from "react";
import { runProjection } from "../services/projection.server";
import { ProductTable, type ProductRow } from "../components/ProductTable";

const MOCK_PRODUCTS = [
  {
    id: "gid://shopify/Product/1001",
    title: "CanaCare Grow Formula",
    vendor: "CanaCare",
    totalInventory: 25000,
    avgDailySales: 170,
    monthlyGrowthRate: 1.1,
    leadTimeDays: 84,
  },
  {
    id: "gid://shopify/Product/1002",
    title: "CanaCare Bloom Boost",
    vendor: "CanaCare",
    totalInventory: 8000,
    avgDailySales: 80,
    monthlyGrowthRate: 1.05,
    leadTimeDays: 84,
  },
  {
    id: "gid://shopify/Product/1003",
    title: "GreenLeaf Root Stimulator",
    vendor: "GreenLeaf",
    totalInventory: 500,
    avgDailySales: 50,
    monthlyGrowthRate: 1.05,
    leadTimeDays: 84,
  },
  {
    id: "gid://shopify/Product/1004",
    title: "GreenLeaf CalMag Plus",
    vendor: "GreenLeaf",
    totalInventory: 200,
    avgDailySales: 100,
    monthlyGrowthRate: 1.0,
    leadTimeDays: 84,
  },
  {
    id: "gid://shopify/Product/1005",
    title: "BioNute Premium Soil",
    vendor: "BioNute",
    totalInventory: 50000,
    avgDailySales: 30,
    monthlyGrowthRate: 1.02,
    leadTimeDays: 84,
  },
];

export const loader = async () => {
  const productRows: ProductRow[] = MOCK_PRODUCTS.map((product) => {
    const projection = runProjection({
      currentInventory: product.totalInventory,
      avgDailySales: product.avgDailySales,
      monthlyGrowthRate: product.monthlyGrowthRate,
      leadTimeDays: product.leadTimeDays,
    });

    return {
      id: product.id,
      title: product.title,
      vendor: product.vendor,
      totalInventory: product.totalInventory,
      avgDailySales: product.avgDailySales,
      daysUntilStockOut: projection.daysUntilStockOut,
      stockOutDate: projection.stockOutDate,
      mustReorderBy: projection.mustReorderBy,
      reorderUrgency: projection.reorderUrgency,
    };
  });

  productRows.sort((a, b) => {
    const urgencyOrder = { critical: 0, warning: 1, ok: 2 };
    const diff =
      urgencyOrder[a.reorderUrgency] - urgencyOrder[b.reorderUrgency];
    if (diff !== 0) return diff;
    return (a.daysUntilStockOut ?? 999) - (b.daysUntilStockOut ?? 999);
  });

  const vendors = [
    ...new Set(MOCK_PRODUCTS.map((p) => p.vendor).filter(Boolean)),
  ].sort();

  return json({ products: productRows, vendors });
};

export default function TestDashboard() {
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
    (p) => p.reorderUrgency === "critical",
  ).length;
  const warningCount = products.filter(
    (p) => p.reorderUrgency === "warning",
  ).length;
  const atRiskCount = criticalCount + warningCount;

  const vendorOptions = [
    { label: "All Brands", value: "" },
    ...vendors.map((v) => ({ label: v, value: v })),
  ];

  return (
    <Page title="StockCast Dashboard (Test Mode)">
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
            </InlineStack>

            {filteredProducts.length === 0 ? (
              <Banner tone="info">
                <p>No products match your search criteria.</p>
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
