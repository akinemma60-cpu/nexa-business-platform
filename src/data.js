export { filterOrdersByPeriod, filterOrdersByCalendarMonths, dailySummary, weeklySummary, monthlyOrderSummary } from "./dates.js";

export function completedRevenue(orders) {
  return orders.filter((order) => order.status === "Completed")
    .reduce((total, order) => total + Number(order.total_amount || 0), 0);
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
