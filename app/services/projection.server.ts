export interface ProjectionInput {
  currentInventory: number;
  avgDailySales: number;
  monthlyGrowthRate: number;
  leadTimeDays: number;
  incomingStock?: { date: Date; quantity: number }[];
  projectionDays?: number;
}

export interface DailyProjection {
  day: number;
  date: string;
  inventory: number;
  dailySales: number;
  incomingStock: number;
}

export interface ProjectionResult {
  stockOutDate: string | null;
  daysUntilStockOut: number | null;
  mustReorderBy: string | null;
  reorderUrgency: "critical" | "warning" | "ok";
  dailyProjection: DailyProjection[];
}

export function runProjection(input: ProjectionInput): ProjectionResult {
  const {
    currentInventory,
    avgDailySales,
    monthlyGrowthRate,
    leadTimeDays,
    incomingStock = [],
    projectionDays = 365,
  } = input;

  const dailyGrowthRate = Math.pow(monthlyGrowthRate, 1 / 30);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const incomingByDay = new Map<number, number>();
  for (const stock of incomingStock) {
    const stockDate = new Date(stock.date);
    stockDate.setHours(0, 0, 0, 0);
    const dayDiff = Math.round(
      (stockDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (dayDiff >= 0) {
      incomingByDay.set(dayDiff, (incomingByDay.get(dayDiff) || 0) + stock.quantity);
    }
  }

  let inventory = currentInventory;
  let dailySales = avgDailySales;
  let stockOutDate: string | null = null;
  let daysUntilStockOut: number | null = null;
  const dailyProjection: DailyProjection[] = [];

  for (let day = 0; day < projectionDays; day++) {
    const currentDate = new Date(today);
    currentDate.setDate(currentDate.getDate() + day);
    const dateStr = currentDate.toISOString().split("T")[0];

    const incoming = incomingByDay.get(day) || 0;
    inventory += incoming;

    dailyProjection.push({
      day,
      date: dateStr,
      inventory: Math.max(0, Math.round(inventory * 100) / 100),
      dailySales: Math.round(dailySales * 100) / 100,
      incomingStock: incoming,
    });

    if (inventory <= 0 && stockOutDate === null) {
      stockOutDate = dateStr;
      daysUntilStockOut = day;
    }

    inventory -= dailySales;

    if (day > 0) {
      dailySales *= dailyGrowthRate;
    }
  }

  let mustReorderBy: string | null = null;
  let reorderUrgency: "critical" | "warning" | "ok" = "ok";

  if (daysUntilStockOut !== null) {
    const reorderDay = daysUntilStockOut - leadTimeDays;
    const reorderDate = new Date(today);
    reorderDate.setDate(reorderDate.getDate() + reorderDay);
    mustReorderBy = reorderDate.toISOString().split("T")[0];

    if (reorderDay <= 0) {
      reorderUrgency = "critical";
    } else if (reorderDay <= 14) {
      reorderUrgency = "warning";
    }
  }

  return {
    stockOutDate,
    daysUntilStockOut,
    mustReorderBy,
    reorderUrgency,
    dailyProjection,
  };
}
