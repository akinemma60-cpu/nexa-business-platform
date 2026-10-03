import { useMemo, useState } from "react";
import { Download, Search, ShoppingBag, Clock3, CircleCheck, Truck, Plus, Trash2, Edit2, LoaderCircle } from "lucide-react";
import { api } from "../lib/api";
import { useBusinessData } from "../data/BusinessDataContext";
import { InitialAvatar, money, PageHeading, StatusPill } from "../components";
import OrderForm from "./OrderForm";

const statuses = ["All orders", "Pending", "Processing", "Completed", "Cancelled"];
export default function Orders() {
  const { orders, customers, products, loading, error: dataError, reload } = useBusinessData();
  const [filter, setFilter] = useState("All orders");
  const [query, setQuery] = useState("");
  const [modalOrder, setModalOrder] = useState(undefined);
  const [actionId, setActionId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const filtered = useMemo(() => orders.filter((order) => {
    const orderItems = (order.order_items || []).map((item) => item.product_name).join(" ");
    const searchable = `${order.id} ${order.customer?.name || "Guest customer"} ${orderItems}`.toLowerCase();
    return (filter === "All orders" || order.status === filter) && searchable.includes(query.trim().toLowerCase());
  }), [filter, orders, query]);
  const totals = {
    processing: orders.filter((order) => order.status === "Processing").length,
    completed: orders.filter((order) => order.status === "Completed").length,
  };
  const openCreate = () => { setError(""); setModalOrder(null); };
  const closeModal = () => setModalOrder(undefined);
  async function saveOrder(message) {
    await reload();
    closeModal();
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  }
  async function updateStatus(order, status) {
    setActionId(order.id); setError("");
    try {
      await api.orders.updateStatus(order.id, status);
      await reload();
      setNotice("Order status updated.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (cause) { setError(cause.message || "Unable to update the order status."); }
    finally { setActionId(null); }
  }
  async function remove(order) {
    if (!window.confirm(`Delete order #${order.id.slice(0, 8).toUpperCase()}? Its reserved stock will be restored.`)) return;
    setActionId(order.id); setError("");
    try {
      await api.orders.remove(order.id);
      await reload();
      setNotice("Order deleted and reserved stock restored.");
      window.setTimeout(() => setNotice(""), 3000);
    } catch (cause) { setError(cause.message || "Unable to delete this order."); }
    finally { setActionId(null); }
  }

  return <>
    <PageHeading eyebrow="FULFILLMENT" title="Orders" subtitle="Track, manage, and fulfill your customer orders." action={<><button className="button button-secondary" onClick={() => window.print()}><Download size={16} /> Print orders</button><button className="button button-primary" onClick={openCreate} disabled={loading}><Plus size={16} /> Create order</button></>} />
    {(error || (dataError && !loading)) && <p className="inline-error" role="alert">{error || dataError}</p>}
    <div className="mini-stats"><div><span className="mini-stat-icon violet"><ShoppingBag size={17} /></span><small>Total orders</small><strong>{loading ? "—" : orders.length}</strong></div><div><span className="mini-stat-icon amber"><Clock3 size={17} /></span><small>Processing</small><strong>{loading ? "—" : totals.processing}</strong></div><div><span className="mini-stat-icon mint"><CircleCheck size={17} /></span><small>Completed</small><strong>{loading ? "—" : totals.completed}</strong></div></div>
    <section className="panel list-panel orders-list-panel"><div className="list-toolbar"><div><h2>All orders <span className="inline-count">{filtered.length}</span></h2><p>Review order details and update fulfillment status</p></div><div className="filter-controls"><label className="table-search"><Search size={16} /><input aria-label="Search orders" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, customer, product" /></label><select className="select-button" value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter order status">{statuses.map((status) => <option key={status}>{status}</option>)}</select></div></div>
      <div className="table-scroll"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>ORDER DATE</th><th>SUBTOTAL</th><th>STATUS</th><th>UPDATE</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{!loading && filtered.map((order, index) => <tr key={order.id}><td className="order-id">#{order.id.slice(0, 8).toUpperCase()}</td><td><span className="customer-cell"><InitialAvatar name={order.customer?.name || "Guest"} index={index} /><span>{order.customer?.name || "Guest customer"}<small className="email-line">{order.customer?.email || ""}</small></span></span></td><td className="order-items-cell">{(order.order_items || []).map((item) => <span key={item.id}>{item.product_name} <small>×{item.quantity}</small></span>)}</td><td className="muted-cell">{new Date(order.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</td><td className="amount-cell">{money(order.total_amount)}</td><td><StatusPill status={order.status} /></td><td><select className="row-select" value={order.status} onChange={(event) => updateStatus(order, event.target.value)} aria-label={`Update order ${order.id} status`} disabled={actionId === order.id || order.status === "Cancelled"}>{order.status === "Cancelled" && <option>Cancelled</option>}{["Pending", "Processing", "Completed"].map((status) => <option key={status}>{status}</option>)}</select></td><td><div className="row-actions"><button className="icon-button" aria-label={`Edit order ${order.id}`} title="Edit order" disabled={actionId === order.id} onClick={() => { setError(""); setModalOrder(order); }}><Edit2 size={15} /></button><button className="icon-button danger-action" aria-label={`Delete order ${order.id}`} title="Delete order" disabled={actionId === order.id} onClick={() => remove(order)}>{actionId === order.id ? <LoaderCircle className="spin" size={15} /> : <Trash2 size={15} />}</button></div></td></tr>)}</tbody></table>
        {loading && <div className="empty-state"><LoaderCircle className="spin" size={22} /><span>Loading orders…</span></div>}
        {!loading && !dataError && filtered.length === 0 && <div className="empty-state"><Truck size={24} /><strong>{query || filter !== "All orders" ? "No matching orders" : "No orders yet"}</strong><span>{query || filter !== "All orders" ? "Try another search or status filter." : "Create an order to see it here."}</span>{!orders.length && <button className="button button-primary" onClick={openCreate}><Plus size={15} /> Create your first order</button>}</div>}
      </div>
    </section>
    {notice && <div className="toast" role="status">{notice}</div>}
    {modalOrder !== undefined && <OrderForm key={modalOrder?.id || "new-order"} products={products} customers={customers} order={modalOrder} dataError={dataError} onRetry={reload} onClose={closeModal} onSaved={saveOrder} />}
  </>;
}
