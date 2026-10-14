import { Suspense, lazy, useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Users, ShoppingCart, BarChart3, Settings, Search, Menu, X, Moon, Sun, ArrowUpRight, LogOut, LoaderCircle } from "lucide-react";
import { useAuth } from "./auth/AuthContext";
import { supabase } from "./lib/supabase";
import Login from "./auth/Login";
import AuthRecovery from "./auth/AuthRecovery";
import { useBusinessData } from "./data/BusinessDataContext";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Products = lazy(() => import("./pages/Products"));
const Customers = lazy(() => import("./pages/Customers"));
const Orders = lazy(() => import("./pages/Orders"));
const Analytics = lazy(() => import("./pages/Analytics"));
const SettingsPage = lazy(() => import("./pages/Settings"));

const navItems = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { name: "Products", path: "/products", icon: Package },
  { name: "Customers", path: "/customers", icon: Users },
  { name: "Orders", path: "/orders", icon: ShoppingCart },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
];

function App() {
  const { user, loading, authError, passwordRecovery, emailConfirmationComplete, configured, configIssue } = useAuth();
  const location = useLocation();
  if (!configured) return <ConfigurationNotice issue={configIssue} />;
  if (loading) return <main className="auth-screen"><div className="auth-loading"><LoaderCircle className="spin" size={26} /><span>Restoring your secure session…</span></div></main>;
  if (emailConfirmationComplete) return <Login sessionError={authError} confirmationSuccess />;
  if (passwordRecovery) return <AuthRecovery />;
  if (!user) return <Routes><Route path="/login" element={<Login sessionError={authError} />} /><Route path="/signup" element={<Login initialMode="signup" sessionError={authError} />} /><Route path="*" element={<Navigate to="/login" replace state={{ from: location }} />} /></Routes>;
  return <WorkspaceApp user={user} />;
}

function ConfigurationNotice({ issue }) {
  const detail = issue === "missing-url"
    ? "Set VITE_SUPABASE_URL to your Supabase project URL."
    : issue === "missing-key"
      ? "Set VITE_SUPABASE_PUBLISHABLE_KEY to the public publishable key. VITE_SUPABASE_ANON_KEY is also supported for existing projects."
      : issue === "invalid-url"
        ? "VITE_SUPABASE_URL must be an absolute HTTP or HTTPS project URL."
        : "Set both the Supabase project URL and a public API key.";
  return <main className="auth-screen"><section className="auth-card setup-card"><div className="brand auth-brand"><div className="brand-mark"><span /></div><span className="brand-name">nexa<span>.</span></span></div><p className="eyebrow">SUPABASE CONNECTION</p><h1>Connect your workspace</h1><p className="auth-subtitle">{detail}</p><p className="auth-subtitle">For local development, set these variables in <code>.env.local</code> and restart Vite. For Netlify, set them in the site’s environment variables and trigger a new build and deployment.</p><pre>VITE_SUPABASE_URL=https://your-project.supabase.co<br />VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key</pre><p className="auth-footnote">Use only a public publishable key or legacy anon key. Never put a service-role or secret key in frontend variables.</p></section></main>;
}

function WorkspaceApp({ user }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => { try { return localStorage.getItem("nexa-theme") === "dark"; } catch { return false; } });
  const [query, setQuery] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { error: dataError, reload, products } = useBusinessData();
  const pageName = location.pathname === "/" || location.pathname === "/dashboard" ? "Dashboard" : navItems.find((item) => item.path === location.pathname)?.name || "Settings";

  useEffect(() => {
    try { localStorage.setItem("nexa-theme", darkMode ? "dark" : "light"); } catch { /* The in-memory theme still works when storage is unavailable. */ }
    document.documentElement.classList.toggle("theme-dark", darkMode);
  }, [darkMode]);
  const handleSearch = (event) => {
    if (event.key !== "Enter" || !query.trim()) return;
    const term = query.trim().toLowerCase();
    navigate(term.includes("order") ? "/orders" : term.includes("customer") ? "/customers" : term.includes("analytic") || term.includes("sale") ? "/analytics" : term.includes("setting") ? "/settings" : "/products");
    setQuery("");
  };
  async function signOut() {
    setLogoutError("");
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setLogoutError(error.message || "Unable to sign out. Please try again.");
    } catch (cause) {
      setLogoutError(cause.message || "Unable to sign out. Please try again.");
    }
  }

  return (
    <div className={`app ${darkMode ? "dark" : ""}`}>
      {sidebarOpen && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><span /></div><span className="brand-name">nexa<span>.</span></span><button className="close-sidebar" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={19} /></button></div>
        <div className="workspace"><span className="workspace-logo">N</span><span className="workspace-copy"><strong>Business workspace</strong><small>Private account</small></span></div>
        <nav className="side-nav"><p className="nav-label">WORKSPACE</p>{navItems.map(({ name, path, icon: Icon }) => <NavLink key={path} to={path} end onClick={() => setSidebarOpen(false)}><Icon size={18} strokeWidth={1.8} /><span>{name}</span></NavLink>)}<p className="nav-label nav-label-spaced">PREFERENCES</p><NavLink to="/settings" onClick={() => setSidebarOpen(false)}><Settings size={18} strokeWidth={1.8} /><span>Settings</span></NavLink></nav>
        <div className="sidebar-bottom"><div className="plan-card"><span className="plan-icon"><Package size={16} /></span><strong>Inventory snapshot</strong><p>{products.length} products in your catalog</p><button onClick={() => navigate("/products")}>View inventory <ArrowUpRight size={14} /></button></div><div className="profile-row"><div className="avatar avatar-indigo">{(user.email || "NA").slice(0, 2).toUpperCase()}</div><div className="profile-copy"><strong>{user.email}</strong><small>Administrator</small></div><button className="button button-secondary sidebar-signout" onClick={signOut}><LogOut size={14} /> Sign out</button></div></div>
      </aside>
      <main className="main-area"><header className="topbar"><div className="topbar-left"><button className="menu-button icon-button" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>{pageName}</strong></div></div><div className="topbar-right"><label className="global-search"><Search size={16} /><input aria-label="Search sections" placeholder="Search sections…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={handleSearch} /><kbd>Enter</kbd></label><span className="topbar-divider" /><button className="icon-button theme-toggle" aria-label={`Switch to ${darkMode ? "light" : "dark"} mode`} onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><button className="avatar avatar-indigo top-avatar" aria-label="Sign out" title="Sign out" onClick={signOut}>{(user.email || "NA").slice(0, 2).toUpperCase()}</button></div></header>{(dataError || logoutError) && <div className="global-error" role="alert"><span>{logoutError || dataError}</span>{dataError && <button className="button button-secondary" onClick={reload}>Retry</button>}</div>}<div className="page-content"><Suspense fallback={<div className="data-loading" role="status"><LoaderCircle className="spin" size={20} />Loading page…</div>}><Routes><Route path="/" element={<Navigate to="/dashboard" replace />} /><Route path="/login" element={<Navigate to={location.state?.from?.pathname && location.state.from.pathname !== "/login" ? location.state.from.pathname : "/dashboard"} replace />} /><Route path="/dashboard" element={<Dashboard />} /><Route path="/products" element={<Products />} /><Route path="/customers" element={<Customers />} /><Route path="/orders" element={<Orders />} /><Route path="/analytics" element={<Analytics />} /><Route path="/settings" element={<SettingsPage darkMode={darkMode} onToggleTheme={() => setDarkMode((value) => !value)} onSignOut={signOut} />} /><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></Suspense><footer className="page-footer"><span>© {new Date().getFullYear()} NEXA</span><span>Business management</span></footer></div></main>
    </div>
  );
}
export default App;
