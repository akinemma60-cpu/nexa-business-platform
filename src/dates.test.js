import assert from "node:assert/strict";
import test from "node:test";
import { dailySummary, dateKey, filterOrdersByCalendarMonths, filterOrdersByPeriod, formatDate, monthlyOrderSummary, weeklySummary } from "./dates.js";

test("calendar dates and labels use the selected time zone", () => {
  const instant = "2026-10-02T00:30:00.000Z";
  assert.equal(dateKey(instant, "Africa/Lagos"), "2026-10-02");
  assert.equal(dateKey(instant, "America/New_York"), "2026-10-01");
  assert.equal(
    formatDate(instant, { year: "numeric", month: "numeric", day: "numeric" }, "America/New_York"),
    new Intl.DateTimeFormat(undefined, { year: "numeric", month: "numeric", day: "numeric", timeZone: "America/New_York" }).format(new Date(instant)),
  );
});

test("period filtering includes the selected timezone's current day and excludes future orders", () => {
  const orders = [
    { id: "today", created_at: "2026-10-02T00:30:00.000Z" },
    { id: "yesterday", created_at: "2026-10-01T20:00:00.000Z" },
    { id: "future", created_at: "2026-10-03T00:00:00.000Z" },
  ];
  assert.deepEqual(
    filterOrdersByPeriod(orders, 1, new Date("2026-10-02T12:00:00.000Z")).map(({ id }) => id),
    ["today"],
  );
});

test("12-month analytics filtering aligns with calendar-month chart buckets", () => {
  const now = new Date("2026-10-14T14:00:00.000Z");
  const orders = [
    { created_at: "2025-10-31T20:00:00.000Z", status: "Completed", total_amount: 50 },
    { created_at: "2025-10-31T23:30:00.000Z", status: "Completed", total_amount: 100 },
    { created_at: "2026-10-14T14:00:00.000Z", status: "Completed", total_amount: 200 },
    { created_at: "2026-10-15T00:00:00.000Z", status: "Completed", total_amount: 300 },
  ];

  const filtered = filterOrdersByCalendarMonths(orders, 12, now);
  const monthly = monthlyOrderSummary(filtered, 12, now);

  assert.deepEqual(filtered.map((order) => order.total_amount), [100, 200]);
  assert.equal(monthly.reduce((sum, month) => sum + month.revenue, 0), 300);
  assert.equal(monthly.reduce((sum, month) => sum + month.orders, 0), filtered.length);
});

test("daily, weekly, and monthly summaries group by the configured timezone calendar", () => {
  const now = new Date("2026-10-02T12:00:00.000Z");
  const orders = [
    { created_at: "2026-10-02T00:30:00.000Z", status: "Completed", total_amount: 25 },
    { created_at: "2026-10-01T20:00:00.000Z", status: "Pending", total_amount: 10 },
  ];
  assert.deepEqual(dailySummary(orders, 1, now), [{ name: "Fri", revenue: 25, orders: 1 }]);
  assert.equal(weeklySummary(orders, 1, now)[0].orders, 2);
  assert.deepEqual(monthlyOrderSummary(orders, 1, now), [{ name: "Oct", revenue: 25, orders: 2 }]);
});

test("invalid dates and non-positive summary ranges are safely ignored", () => {
  assert.equal(dateKey("not a date", "Africa/Lagos"), null);
  assert.deepEqual(filterOrdersByPeriod([{ created_at: "not a date" }], 2), []);
  assert.deepEqual(dailySummary([], 0), []);
  assert.deepEqual(weeklySummary([], 0), []);
  assert.deepEqual(monthlyOrderSummary([], 0), []);
});
