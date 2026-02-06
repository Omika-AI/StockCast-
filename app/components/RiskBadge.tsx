import { Badge } from "@shopify/polaris";

interface RiskBadgeProps {
  urgency: "critical" | "warning" | "ok";
  daysUntilStockOut: number | null;
}

export function RiskBadge({ urgency, daysUntilStockOut }: RiskBadgeProps) {
  if (urgency === "critical") {
    return (
      <Badge tone="critical">
        {daysUntilStockOut !== null && daysUntilStockOut <= 0
          ? "Out of Stock"
          : "Reorder Now"}
      </Badge>
    );
  }

  if (urgency === "warning") {
    return <Badge tone="warning">Reorder Soon</Badge>;
  }

  if (daysUntilStockOut === null) {
    return <Badge tone="success">Well Stocked</Badge>;
  }

  return <Badge tone="success">OK</Badge>;
}
