import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DailyProjection {
  day: number;
  date: string;
  inventory: number;
  dailySales: number;
  incomingStock: number;
}

interface ProjectionChartProps {
  data: DailyProjection[];
  stockOutDate: string | null;
  mustReorderBy: string | null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ProjectionChart({
  data,
  stockOutDate,
  mustReorderBy,
}: ProjectionChartProps) {
  const maxDays = stockOutDate
    ? Math.min(
        data.findIndex((d) => d.date === stockOutDate) + 30,
        data.length
      )
    : Math.min(180, data.length);

  const chartData = data.slice(0, maxDays).map((d) => ({
    ...d,
    label: formatDate(d.date),
  }));

  return (
    <div style={{ width: "100%", height: 400 }}>
      <ResponsiveContainer>
        <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="inventoryGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#008060" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#008060" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12 }}
            interval={Math.max(1, Math.floor(chartData.length / 10))}
          />
          <YAxis
            tick={{ fontSize: 12 }}
            tickFormatter={(val) =>
              val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val)
            }
          />
          <Tooltip
            formatter={(value: number, name: string) => {
              if (name === "inventory") return [value.toLocaleString(), "Inventory"];
              if (name === "dailySales") return [value.toFixed(1), "Daily Sales"];
              return [value, name];
            }}
            labelFormatter={(label) => label}
          />
          <ReferenceLine y={0} stroke="#e53e3e" strokeDasharray="5 5" label="Out of Stock" />
          {stockOutDate && (
            <ReferenceLine
              x={formatDate(stockOutDate)}
              stroke="#e53e3e"
              strokeWidth={2}
              label={{ value: "Stock-Out", position: "top", fill: "#e53e3e" }}
            />
          )}
          {mustReorderBy && (
            <ReferenceLine
              x={formatDate(mustReorderBy)}
              stroke="#dd6b20"
              strokeWidth={2}
              strokeDasharray="5 5"
              label={{
                value: "Must Reorder",
                position: "top",
                fill: "#dd6b20",
              }}
            />
          )}
          <Area
            type="monotone"
            dataKey="inventory"
            stroke="#008060"
            strokeWidth={2}
            fill="url(#inventoryGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
