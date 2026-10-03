const validDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export function completedRevenue(orders) {
  return orders.filter((order) => order.status === "Completed")
    .reduce((total, order) => total + Number(order.total_amount || 0), 0);
}

export function filterOrdersByPeriod(orders, days) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return orders.filter((order) => {
    const created = validDate(order.created_at);
    return created && created >= start;
  });
}

export function dailySummary(orders, days = 7) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (days - index - 1));
    const dayOrders = orders.filter((order) => {
      const created = validDate(order.created_at);
      return created && created.toDateString() === date.toDateString();
    });
    const salesOrders = dayOrders.filter((order) => order.status === "Completed");
    return {
      name: days <= 7 ? date.toLocaleDateString("en", { weekday: "short" }) : date.toLocaleDateString("en", { month: "short", day: "numeric" }),
      revenue: salesOrders.reduce((total, order) => total + Number(order.total_amount || 0), 0),
      orders: dayOrders.length,
    };
  });
}

export function weeklySummary(orders, weeks = 13) {
  return Array.from({ length: weeks }, (_, index) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((weeks - index) * 7) + 1);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const group = orders.filter((order) => {
      const created = validDate(order.created_at);
      return created && created >= start && created < end;
    });
    return { name: start.toLocaleDateString("en", { month: "short", day: "numeric" }), revenue: group.filter((order) => order.status === "Completed").reduce((sum, order) => sum + Number(order.total_amount || 0), 0), orders: group.length };
  });
}

export function monthlyOrderSummary(orders, months = 6) {
  return Array.from({ length: months }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (months - index - 1));
    const group = orders.filter((order) => {
      const created = validDate(order.created_at);
      return created && created.getMonth() === date.getMonth() && created.getFullYear() === date.getFullYear();
    });
    const sales = group.filter((order) => order.status === "Completed");
    return {
      name: date.toLocaleDateString("en", { month: "short" }),
      revenue: sales.reduce((total, order) => total + Number(order.total_amount || 0), 0),
      orders: group.length,
    };
  });
}

export function orderStatusBreakdown(orders) {
  return ["Completed", "Processing", "Pending", "Cancelled"]
    .map((name) => ({ name, value: orders.filter((order) => order.status === name).length }))
    .filter((item) => item.value > 0);
}

export function topProducts(orders, limit = 5) {
  const products = new Map();
  orders.filter((order) => order.status !== "Cancelled").forEach((order) => {
    (order.order_items || []).forEach((item) => {
      const key = item.product_id || item.product_name;
      const product = products.get(key) || { name: item.product_name, units: 0, revenue: 0 };
      product.units += Number(item.quantity || 0);
      product.revenue += Number(item.unit_price || 0) * Number(item.quantity || 0);
      products.set(key, product);
    });
  });
  return [...products.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue).slice(0, limit);
}

export function customerActivity(orders, customers, limit = 5) {
  const activity = new Map();
  orders.filter((order) => order.status !== "Cancelled" && order.customer_id).forEach((order) => {
    const summary = activity.get(order.customer_id) || { orderCount: 0, spend: 0, lastOrder: null };
    summary.orderCount += 1;
    if (order.status === "Completed") summary.spend += Number(order.total_amount || 0);
    if (!summary.lastOrder || new Date(order.created_at) > new Date(summary.lastOrder)) summary.lastOrder = order.created_at;
    activity.set(order.customer_id, summary);
  });
  return [...activity.entries()].map(([customerId, summary]) => ({
    customer: customers.find((item) => item.id === customerId), ...summary,
  })).filter((item) => item.customer).sort((a, b) => new Date(b.lastOrder) - new Date(a.lastOrder)).slice(0, limit);
}
