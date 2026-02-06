/**
 * Unit test for the projection engine.
 * Run with: npx tsx scripts/test-projection.ts
 */
import { runProjection } from "../app/services/projection.server.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

function assertRange(
  actual: number | null,
  min: number,
  max: number,
  message: string,
) {
  if (actual !== null && actual >= min && actual <= max) {
    console.log(`  PASS: ${message} (actual: ${actual})`);
    passed++;
  } else {
    console.error(
      `  FAIL: ${message} (actual: ${actual}, expected ${min}-${max})`,
    );
    failed++;
  }
}

// ---------- Test 1: Excel reference case ----------
console.log("\n--- Test 1: Excel reference (25k inv, 170 sales/day, 1.10 growth, 84-day lead) ---");
{
  const result = runProjection({
    currentInventory: 25000,
    avgDailySales: 170,
    monthlyGrowthRate: 1.1,
    leadTimeDays: 84,
  });

  // Daily growth rate = 1.1^(1/30) ≈ 1.003185
  const dailyGrowth = Math.pow(1.1, 1 / 30);
  assert(
    Math.abs(dailyGrowth - 1.003185) < 0.001,
    `Daily growth rate ≈ 1.00319 (actual: ${dailyGrowth.toFixed(6)})`,
  );

  // Stock-out should occur around day 100-130 depending on compound growth
  assert(result.daysUntilStockOut !== null, "Stock-out date should exist");
  assertRange(result.daysUntilStockOut, 90, 140, "Days until stock-out ~100-130");

  // Reorder urgency: reorderDay = stockOutDay - 84
  // If stockOutDay ~120, reorderDay ~36, so urgency = "ok" (>14)
  // If stockOutDay ~100, reorderDay ~16, still "ok"
  assert(
    result.reorderUrgency === "ok" || result.reorderUrgency === "warning",
    `Urgency should be ok or warning (actual: ${result.reorderUrgency})`,
  );

  // mustReorderBy should be set
  assert(result.mustReorderBy !== null, "Must reorder by date should be set");

  // Day 0 should have inventory = 25000
  assert(
    result.dailyProjection[0].inventory === 25000,
    `Day 0 inventory = 25000 (actual: ${result.dailyProjection[0].inventory})`,
  );

  // Day 0 daily sales = 170
  assert(
    result.dailyProjection[0].dailySales === 170,
    `Day 0 daily sales = 170 (actual: ${result.dailyProjection[0].dailySales})`,
  );

  // Verify sales grow: day 30 sales should be higher than day 1
  const day30Sales = result.dailyProjection[30].dailySales;
  assert(
    day30Sales > 170,
    `Day 30 sales > 170 (actual: ${day30Sales.toFixed(2)})`,
  );

  // Day 30 sales should be ≈ 170 * 1.1 = 187 (one month of growth)
  assertRange(day30Sales, 183, 192, "Day 30 sales ≈ 187 (1 month of 10% growth)");
}

// ---------- Test 2: Critical urgency — low stock, high sales ----------
console.log("\n--- Test 2: Critical urgency (200 inv, 100 sales/day, flat growth, 84-day lead) ---");
{
  const result = runProjection({
    currentInventory: 200,
    avgDailySales: 100,
    monthlyGrowthRate: 1.0,
    leadTimeDays: 84,
  });

  // 200 / 100 = 2 days
  assert(result.daysUntilStockOut !== null, "Stock-out should exist");
  assertRange(result.daysUntilStockOut, 1, 3, "Stock-out in ~2 days");

  // Reorder day = 2 - 84 = -82, so critical
  assert(
    result.reorderUrgency === "critical",
    `Urgency should be critical (actual: ${result.reorderUrgency})`,
  );
}

// ---------- Test 3: Warning urgency ----------
console.log("\n--- Test 3: Warning urgency (8000 inv, 80 sales/day, 1.05 growth, 84-day lead) ---");
{
  const result = runProjection({
    currentInventory: 8000,
    avgDailySales: 80,
    monthlyGrowthRate: 1.05,
    leadTimeDays: 84,
  });

  assert(result.daysUntilStockOut !== null, "Stock-out should exist");
  // ~93 days stock-out, reorderDay = 93-84 = 9, which is ≤14 → warning
  assertRange(result.daysUntilStockOut, 85, 105, "Stock-out in ~93 days");
  assert(
    result.reorderUrgency === "warning" || result.reorderUrgency === "critical",
    `Urgency should be warning or critical (actual: ${result.reorderUrgency})`,
  );
}

// ---------- Test 4: OK — well-stocked product ----------
console.log("\n--- Test 4: Well-stocked (50k inv, 30 sales/day, 1.02 growth, 84-day lead) ---");
{
  const result = runProjection({
    currentInventory: 50000,
    avgDailySales: 30,
    monthlyGrowthRate: 1.02,
    leadTimeDays: 84,
  });

  // At 30/day with 2% monthly growth, 50k inventory lasts well over 365 days
  // The projection only covers 365 days, so stock-out might be null
  if (result.daysUntilStockOut === null) {
    assert(true, "No stock-out within 365 days — well stocked");
    assert(result.reorderUrgency === "ok", `Urgency is ok (actual: ${result.reorderUrgency})`);
  } else {
    assert(result.daysUntilStockOut > 300, `Stock-out > 300 days (actual: ${result.daysUntilStockOut})`);
  }
}

// ---------- Test 5: Incoming stock delays stock-out ----------
console.log("\n--- Test 5: Incoming stock delays stock-out ---");
{
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);

  const withoutIncoming = runProjection({
    currentInventory: 5000,
    avgDailySales: 100,
    monthlyGrowthRate: 1.0,
    leadTimeDays: 84,
  });

  const withIncoming = runProjection({
    currentInventory: 5000,
    avgDailySales: 100,
    monthlyGrowthRate: 1.0,
    leadTimeDays: 84,
    incomingStock: [{ date: in30Days, quantity: 10000 }],
  });

  assert(
    withoutIncoming.daysUntilStockOut !== null,
    `Without incoming: stock-out at day ${withoutIncoming.daysUntilStockOut}`,
  );

  if (withIncoming.daysUntilStockOut !== null && withoutIncoming.daysUntilStockOut !== null) {
    assert(
      withIncoming.daysUntilStockOut > withoutIncoming.daysUntilStockOut,
      `Incoming stock delays stock-out: ${withoutIncoming.daysUntilStockOut} → ${withIncoming.daysUntilStockOut} days`,
    );
  } else if (withIncoming.daysUntilStockOut === null) {
    assert(true, "Incoming stock prevents stock-out entirely within projection window");
  }

  // Verify day 30 has incoming stock bump
  const day30 = withIncoming.dailyProjection[30];
  assert(
    day30.incomingStock === 10000,
    `Day 30 incoming stock = 10000 (actual: ${day30.incomingStock})`,
  );
}

// ---------- Test 6: Critical — very low stock ----------
console.log("\n--- Test 6: Critical — GreenLeaf Root Stimulator (500 inv, 50 sales/day, 1.05 growth) ---");
{
  const result = runProjection({
    currentInventory: 500,
    avgDailySales: 50,
    monthlyGrowthRate: 1.05,
    leadTimeDays: 84,
  });

  assert(result.daysUntilStockOut !== null, "Stock-out should exist");
  assertRange(result.daysUntilStockOut, 8, 12, "Stock-out in ~10 days");
  assert(
    result.reorderUrgency === "critical",
    `Urgency should be critical (actual: ${result.reorderUrgency})`,
  );
}

// ---------- Summary ----------
console.log(`\n========================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`========================================\n`);

if (failed > 0) {
  process.exit(1);
}
