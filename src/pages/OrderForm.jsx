import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, LoaderCircle, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { api } from "../lib/api";
import { money } from "../components";

const editableStatuses = ["Pending", "Processing", "Completed"];
const lineAmount = (item) => Math.round(Number(item.unit_price) * 100) * Number(item.quantity) / 100;

export default function OrderForm({ products, customers, order = null, dataError = "", onRetry, onClose, onSaved }) {
  const editing = Boolean(order);
  const [customerId, setCustomerId] = useState(order?.customer_id || "");
  const [status, setStatus] = useState(order?.status || "Pending");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [productError, setProductError] = useState("");
  const availableProducts = products.map((product) => {
    const alreadyAdded = items.find((item) => item.product_id === product.id)?.quantity || 0;
    const remaining = Math.max(0, Number(product.stock) - alreadyAdded);
    return {
      value: product.id,
      label: product.name,
      detail: `${product.category || "Other"} · ${remaining} available · ${money(product.price)}`,
      disabled: remaining <= 0,
      outOfStock: Number(product.stock) <= 0,
      stock: Number(product.stock),
      price: Number(product.price),
    };
  });
  const customerOptions = customers.map((customer) => ({
    value: customer.id,
    label: customer.name,
    detail: customer.email || customer.phone || "Customer",
  }));
  const selectedProduct = products.find((product) => product.id === productId);
  const subtotal = useMemo(() => items.reduce((sum, item) => sum + lineAmount(item), 0), [items]);
  const canAddProducts = availableProducts.some((product) => !product.disabled);

  function addItem() {
    if (!selectedProduct) {
      setProductError(products.length ? "Choose a product from the list." : "Add a product to your catalog first.");
      return;
    }
    const count = Math.max(1, Math.floor(Number(quantity) || 1));
    const current = items.find((item) => item.product_id === selectedProduct.id);
    const nextQuantity = count + (current?.quantity || 0);
    if (nextQuantity > Number(selectedProduct.stock)) {
      setProductError(`Only ${selectedProduct.stock - (current?.quantity || 0)} more units of ${selectedProduct.name} are available.`);
      return;
    }
    setItems(current
      ? items.map((item) => item.product_id === selectedProduct.id ? { ...item, quantity: nextQuantity } : item)
      : [...items, { product_id: selectedProduct.id, product_name: selectedProduct.name, quantity: count, unit_price: Number(selectedProduct.price) }]);
    setProductId("");
    setQuantity(1);
    setProductError("");
  }

  function setItemQuantity(item, nextQuantity) {
    const product = products.find((entry) => entry.id === item.product_id);
    const next = Math.max(1, Math.min(Number(product?.stock || item.quantity), Math.floor(Number(nextQuantity) || 1)));
    setItems((current) => current.map((row) => row.product_id === item.product_id ? { ...row, quantity: next } : row));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if (dataError) {
      setError("Retry loading your customer and product data before saving.");
      return;
    }
    if (!editing && items.length === 0) {
      setError("Add at least one in-stock product to this order.");
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await api.orders.update(order.id, { customer_id: customerId, status });
      } else {
        await api.orders.create({
          customer_id: customerId,
          status,
          items: items.map(({ product_id, quantity: count }) => ({ product_id, quantity: count })),
        });
      }
      await onSaved(editing ? "Order updated." : "Order created.");
    } catch (cause) {
      setError(cause.message || `Unable to ${editing ? "update" : "create"} this order.`);
    } finally {
      setBusy(false);
    }
  }

  const dateLabel = order?.created_at
    ? new Date(order.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
    : new Date().toLocaleDateString(undefined, { dateStyle: "medium" });

  return <div className="modal-backdrop order-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form className="modal-card order-modal" onSubmit={submit}>
      <div className="modal-heading"><div><p className="eyebrow">FULFILLMENT</p><h2>{editing ? "Edit order" : "Create an order"}</h2><p className="order-modal-subtitle">{editing ? `Order #${order.id.slice(0, 8).toUpperCase()}` : "Add a customer and one or more products."}</p></div><button type="button" className="icon-button" aria-label="Close" onClick={onClose}><X size={18} /></button></div>

      <div className="order-form-grid">
        <label className="form-field">Customer <span className="optional-label">Optional</span><SearchSelect label="Search customers" value={customerId} options={customerOptions} onChange={setCustomerId} emptyText="No customers found." clearLabel="Guest customer" /></label>
        <label className="form-field">Order date<div className="order-date-field"><strong>{dateLabel}</strong><small>{editing ? "Original order date" : "Assigned when the order is saved"}</small></div></label>
        <label className="form-field">Status<select value={status} onChange={(event) => setStatus(event.target.value)} disabled={editing && status === "Cancelled"}>{(status === "Cancelled" ? ["Cancelled", ...editableStatuses] : editableStatuses).map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
      </div>

      {editing ? <section className="existing-items"><div className="order-section-heading"><div><h3>Order items</h3><p>Line items are saved as a price snapshot.</p></div></div>{(order.order_items || []).map((item) => <div className="existing-order-line" key={item.id}><span><strong>{item.product_name}</strong><small>Qty {item.quantity} · {money(item.unit_price)} each</small></span><strong>{money(Number(item.unit_price) * Number(item.quantity))}</strong></div>)}<div className="order-total-row"><span>Order total</span><strong>{money(order.total_amount)}</strong></div></section> : <section className="add-products-section"><div className="order-section-heading"><div><h3>Add products</h3><p>Prices are taken from your current catalog.</p></div><span className="order-item-count">{items.length} {items.length === 1 ? "item" : "items"}</span></div>
        <div className="order-product-picker"><label className="form-field">Product<SearchSelect label="Search products" value={productId} options={availableProducts} onChange={(value) => { setProductId(value); setProductError(""); }} emptyText={products.length ? "No products match that search." : "Your catalog has no products yet."} /></label><label className="form-field quantity-input-label">Qty<div className="quantity-entry"><button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((current) => Math.max(1, Number(current) - 1))}><Minus size={14} /></button><input type="number" min="1" max={selectedProduct?.stock || undefined} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} /><button type="button" aria-label="Increase quantity" onClick={() => setQuantity((current) => Number(current) + 1)}><Plus size={14} /></button></div></label><button type="button" className="button button-secondary add-product-button" onClick={addItem} disabled={!canAddProducts || !selectedProduct}><Plus size={15} /> Add</button></div>
        {dataError && <div className="order-data-error" role="alert"><span>{dataError}</span><button type="button" className="text-link" onClick={onRetry}>Retry loading data</button></div>}
        {!dataError && products.length === 0 && <p className="selector-help">There are no products in this workspace. <Link to="/products" onClick={onClose}>Add a product</Link></p>}
        {!dataError && products.length > 0 && !products.some((product) => Number(product.stock) > 0) && <p className="selector-help">All catalog products are out of stock. Restock a product before creating this order. <Link to="/products" onClick={onClose}>Manage products</Link></p>}
        {!dataError && products.some((product) => Number(product.stock) > 0) && !canAddProducts && <p className="selector-help">All available units from these products are already in this order. Remove an item or lower its quantity to add more.</p>}
        {productError && <p className="form-error" role="alert">{productError}</p>}
        {items.length > 0 && <div className="order-lines">{items.map((item) => <div className="order-line" key={item.product_id}><span className="order-line-name"><strong>{item.product_name}</strong><small>{money(item.unit_price)} each</small></span><div className="line-quantity"><button type="button" aria-label={`Decrease ${item.product_name} quantity`} onClick={() => setItemQuantity(item, item.quantity - 1)}><Minus size={13} /></button><span>{item.quantity}</span><button type="button" aria-label={`Increase ${item.product_name} quantity`} onClick={() => setItemQuantity(item, item.quantity + 1)} disabled={item.quantity >= Number(products.find((entry) => entry.id === item.product_id)?.stock || item.quantity)}><Plus size={13} /></button></div><strong className="line-total">{money(lineAmount(item))}</strong><button type="button" className="icon-button danger-action remove-line" aria-label={`Remove ${item.product_name}`} onClick={() => setItems((current) => current.filter((row) => row.product_id !== item.product_id))}><Trash2 size={15} /></button></div>)}</div>}
        <div className="order-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Tax</span><small>Not configured</small></div><div className="order-total-row"><span>Total</span><strong>{money(subtotal)}</strong></div></div>
      </section>}

      {error && <p className="form-error order-form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={busy || Boolean(dataError) || (!editing && !items.length)}>{busy && <LoaderCircle className="spin" size={15} />}{busy ? "Saving…" : editing ? "Save order" : "Create order"}</button></div>
    </form>
  </div>;
}

function SearchSelect({ label, value, options, onChange, emptyText, clearLabel }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => `${option.label} ${option.detail || ""}`.toLowerCase().includes(query.toLowerCase()));
  function choose(option) { onChange(option.value); setQuery(""); setOpen(false); }
  return <div className="search-select">
    <div className="search-select-control"><Search size={15} /><input role="combobox" aria-label={label} aria-expanded={open} aria-autocomplete="list" placeholder={selected ? selected.label : label} value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); }} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); if (event.key === "Enter" && open && filtered.length) { event.preventDefault(); if (!filtered[0].disabled) choose(filtered[0]); } }} /><button type="button" className="selector-chevron" aria-label={`Toggle ${label}`} onClick={() => setOpen((current) => !current)}><ChevronDown size={15} /></button></div>
    {selected && !query && <button type="button" className="selected-option-clear" onClick={() => onChange("")}>{selected.label}<X size={13} /></button>}
    {open && <><button type="button" className="select-dismiss" aria-label="Close options" onClick={() => setOpen(false)} /><div className="search-select-menu" role="listbox">{clearLabel && <button type="button" className="search-option guest-option" role="option" aria-selected={!value} onClick={() => choose({ value: "" })}><span><strong>{clearLabel}</strong><small>Continue without linking a customer</small></span>{!value && <Check size={15} />}</button>}{filtered.map((option) => <button type="button" className="search-option" key={option.value} role="option" aria-selected={option.value === value} disabled={option.disabled} onClick={() => choose(option)}><span><strong>{option.label}</strong>{option.detail && <small>{option.detail}{option.disabled && (option.outOfStock ? " · Out of stock" : " · All available units added")}</small>}</span>{option.value === value && <Check size={15} />}</button>)}{filtered.length === 0 && <div className="selector-no-match">{emptyText}</div>}</div></>}
  </div>;
}
