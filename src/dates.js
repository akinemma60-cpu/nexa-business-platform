const supportedTimeZones = ["Africa/Lagos", "Europe/London", "America/New_York"];

export function getPreferredTimeZone() {
  try {
    const timezone = JSON.parse(localStorage.getItem("nexa-settings") || "{}").timezone;
    return supportedTimeZones.includes(timezone) ? timezone : "Africa/Lagos";
  } catch {
    return "Africa/Lagos";
  }
}

export function dateKey(value, timezone = getPreferredTimeZone()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatDate(value, options = { dateStyle: "medium" }, timezone = getPreferredTimeZone()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: timezone }).format(date);
}

function shiftDateKey(key, amount) {
  const date = new Date(`${key}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function labelDateKey(key, options) {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(new Date(`${key}T12:00:00.000Z`));
}

export function filterOrdersByPeriod(orders, days, now = new Date()) {
  if (!Number.isInteger(days) || days < 1) return [];
  const today = dateKey(now);
  const start = shiftDateKey(today, -(days - 1));
  return orders.filter((order) => {
    const created = dateKey(order.created_at);
    return created && created >= start && created <= today;
  });
}

export function filterOrdersByCalendarMonths(orders, months, now = new Date()) {
  if (!Number.isInteger(months) || months < 1) return [];
  const today = dateKey(now);
  if (!today) return [];

  const [year, month] = today.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - months, 1)).toISOString().slice(0, 10);
  return orders.filter((order) => {
    const created = dateKey(order.created_at);
    return created && created >= start && created <= today;
  });
}

export function dailySummary(orders, days = 7, now = new Date()) {
  const today = dateKey(now);
  return Array.from({ length: days }, (_, index) => {
    const key = shiftDateKey(today, -(days - index - 1));
    const dayOrders = orders.filter((order) => dateKey(order.created_at) === key);
    const salesOrders = dayOrders.filter((order) => order.status === "Completed");
    return {
      name: labelDateKey(key, days <= 7 ? { weekday: "short" } : { month: "short", day: "numeric" }),
      revenue: salesOrders.reduce((total, order) => total + Number(order.total_amount || 0), 0),
      orders: dayOrders.length,
    };
  });
}

export function weeklySummary(orders, weeks = 13, now = new Date()) {
  const today = dateKey(now);
  return Array.from({ length: weeks }, (_, index) => {
    const start = shiftDateKey(today, -((weeks - index) * 7) + 1);
    const end = shiftDateKey(start, 7);
    const group = orders.filter((order) => {
      const created = dateKey(order.created_at);
      return created && created >= start && created < end;
    });
    return {
      name: labelDateKey(start, { month: "short", day: "numeric" }),
      revenue: group.filter((order) => order.status === "Completed")
        .reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      orders: group.length,
    };
  });
}

export function monthlyOrderSummary(orders, months = 6, now = new Date()) {
  if (!Number.isInteger(months) || months < 1) return [];
  const currentMonth = dateKey(now).slice(0, 7);
  const [year, month] = currentMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  return Array.from({ length: months }, (_, index) => {
    const date = new Date(start);
    date.setUTCMonth(date.getUTCMonth() + index);
    const monthKey = date.toISOString().slice(0, 7);
    const group = orders.filter((order) => dateKey(order.created_at)?.slice(0, 7) === monthKey);
    return {
      name: labelDateKey(`${monthKey}-01`, { month: "short" }),
      revenue: group.filter((order) => order.status === "Completed")
        .reduce((total, order) => total + Number(order.total_amount || 0), 0),
      orders: group.length,
    };
  });
}
