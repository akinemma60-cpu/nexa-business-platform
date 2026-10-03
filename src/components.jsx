/* eslint-disable react-refresh/only-export-components */
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

function preferredCurrency() {
  try {
    const candidate = String(JSON.parse(localStorage.getItem("nexa-settings") || "{}").currency || "NGN").slice(0, 3).toUpperCase();
    return ["NGN", "USD", "GBP"].includes(candidate) ? candidate : "NGN";
  }
  catch { return "NGN"; }
}
export const money = (amount) => {
  const currency = preferredCurrency();
  const locale = currency === "NGN" ? "en-NG" : currency === "GBP" ? "en-GB" : "en-US";
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: currency === "NGN" ? 0 : 2 }).format(Number(amount || 0));
};
export function PageHeading({ eyebrow, title, subtitle, action }) {
  return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}
export function StatCard({ label, value, change, icon: Icon, tone = "violet", note }) {
  const positive = !String(change).startsWith("-");
  return <article className="stat-card"><div className="stat-top"><span className={`stat-icon ${tone}`}><Icon size={18} strokeWidth={1.8} /></span></div><p className="stat-label">{label}</p><div className="stat-value">{value}</div><div className="stat-foot">{change && <span className={positive ? "change positive" : "change negative"}>{positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{change}</span>}<span>{note || ""}</span></div></article>;
}
export function StatusPill({ status }) {
  const key = String(status).toLowerCase().replaceAll(" ", "-");
  return <span className={`status-pill ${key}`}><i />{status}</span>;
}
export function InitialAvatar({ name, index = 0 }) {
  const colors = ["avatar-indigo", "avatar-coral", "avatar-teal", "avatar-amber", "avatar-blue"];
  return <span className={`avatar ${colors[index % colors.length]}`}>{name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>;
}
