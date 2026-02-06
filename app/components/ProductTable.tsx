import {
  IndexTable,
  Text,
  useBreakpoints,
} from "@shopify/polaris";
import { useNavigate } from "@remix-run/react";
import { RiskBadge } from "./RiskBadge";

export interface ProductRow {
  id: string;
  title: string;
  vendor: string;
  totalInventory: number;
  avgDailySales: number;
  daysUntilStockOut: number | null;
  stockOutDate: string | null;
  mustReorderBy: string | null;
  reorderUrgency: "critical" | "warning" | "ok";
}

interface ProductTableProps {
  products: ProductRow[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function extractNumericId(gid: string): string {
  const parts = gid.split("/");
  return parts[parts.length - 1];
}

export function ProductTable({ products }: ProductTableProps) {
  const navigate = useNavigate();
  const { smUp } = useBreakpoints();

  const rowMarkup = products.map((product, index) => (
    <IndexTable.Row
      id={product.id}
      key={product.id}
      position={index}
      onClick={() => navigate(`/app/product/${extractNumericId(product.id)}`)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {product.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{product.vendor || "-"}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" alignment="end" numeric>
          {product.totalInventory.toLocaleString()}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" alignment="end" numeric>
          {product.avgDailySales.toFixed(1)}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" alignment="end" numeric>
          {product.daysUntilStockOut !== null
            ? `${product.daysUntilStockOut} days`
            : "365+"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{formatDate(product.stockOutDate)}</IndexTable.Cell>
      <IndexTable.Cell>{formatDate(product.mustReorderBy)}</IndexTable.Cell>
      <IndexTable.Cell>
        <RiskBadge
          urgency={product.reorderUrgency}
          daysUntilStockOut={product.daysUntilStockOut}
        />
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <IndexTable
      condensed={!smUp}
      itemCount={products.length}
      headings={[
        { title: "Product" },
        { title: "Brand" },
        { title: "Stock", alignment: "end" },
        { title: "Avg Daily Sales", alignment: "end" },
        { title: "Days Left", alignment: "end" },
        { title: "Stock-Out Date" },
        { title: "Reorder By" },
        { title: "Risk" },
      ]}
      selectable={false}
    >
      {rowMarkup}
    </IndexTable>
  );
}
