import { useState } from "react";
import { Building2, Check, Globe2, LockKeyhole, LogOut, Moon, Save, Sun, UserRound } from "lucide-react";
import { PageHeading } from "../components";
import { useAuth } from "../auth/AuthContext";

const defaultSettings = { store: "", phone: "", currency: "NGN", timezone: "Africa/Lagos" };
function readSettings() {
  try {
    const settings = { ...defaultSettings, ...JSON.parse(localStorage.getItem("nexa-settings") || "{}") };
    settings.currency = String(settings.currency || "NGN").slice(0, 3).toUpperCase();
    if (!["NGN", "USD", "GBP"].includes(settings.currency)) settings.currency = "NGN";
    settings.timezone = String(settings.timezone || "Africa/Lagos").split(" ")[0];
    if (settings.store === "Nexa Store") settings.store = "";
    return settings;
  }
  catch { return defaultSettings; }
}
export default function SettingsPage({ darkMode, onToggleTheme, onSignOut }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState(readSettings);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const change = (key, value) => { setSettings((current) => ({ ...current, [key]: value })); setSaved(false); setSaveError(""); };
  const save = (event) => {
    event.preventDefault();
    try {
      localStorage.setItem("nexa-settings", JSON.stringify(settings));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2400);
    } catch {
      setSaveError("Could not save these preferences in this browser. Check available storage and try again.");
    }
  };
  return <><PageHeading eyebrow="PREFERENCES" title="Settings" subtitle="Manage this browser’s business and appearance preferences." />
    <form onSubmit={save} className="settings-layout"><nav className="settings-nav" aria-label="Settings sections"><a className="selected" href="#business"><Building2 size={16} /> Business</a><a href="#regional"><Globe2 size={16} /> Regional</a><a href="#appearance"><Moon size={16} /> Appearance</a><a href="#account"><LockKeyhole size={16} /> Account</a></nav>
      <div className="settings-main"><section className="panel settings-section" id="business"><div className="settings-title"><span className="settings-icon"><Building2 size={17} /></span><div><h2>Business profile</h2><p>These details are saved in this browser for your workspace.</p></div></div><div className="settings-form-grid"><label className="form-field">Business name<input value={settings.store} onChange={(e) => change("store", e.target.value)} placeholder="Enter your business name" maxLength={80} /></label><label className="form-field">Contact phone<input type="tel" value={settings.phone} onChange={(e) => change("phone", e.target.value)} placeholder="Optional" maxLength={40} /></label></div></section>
        <section className="panel settings-section" id="regional"><div className="settings-title"><span className="settings-icon"><Globe2 size={17} /></span><div><h2>Regional preferences</h2><p>Currency is used across totals and chart tooltips in this browser.</p></div></div><div className="settings-form-grid"><label className="form-field">Currency<select value={settings.currency} onChange={(e) => change("currency", e.target.value)}><option value="NGN">NGN — Nigerian Naira (₦)</option><option value="USD">USD — US Dollar ($)</option><option value="GBP">GBP — British Pound (£)</option></select></label><label className="form-field">Time zone<select value={settings.timezone} onChange={(e) => change("timezone", e.target.value)}><option value="Africa/Lagos">Africa/Lagos (WAT)</option><option value="Europe/London">Europe/London (GMT)</option><option value="America/New_York">America/New_York (ET)</option></select></label></div><p className="settings-note">Changing the time zone is saved as a preference; dates currently follow your browser’s locale.</p></section>
        <section className="panel settings-section" id="appearance"><div className="settings-title"><span className="settings-icon">{darkMode ? <Moon size={17} /> : <Sun size={17} />}</span><div><h2>Appearance</h2><p>Theme preference is saved automatically on this device.</p></div></div><div className="toggle-row"><span><strong>{darkMode ? "Dark mode" : "Light mode"}</strong><small>Switch between the two NEXA color themes.</small></span><button type="button" className={`toggle ${darkMode ? "on" : ""}`} role="switch" aria-checked={darkMode} aria-label="Dark mode" onClick={onToggleTheme}><i /></button></div></section>
        <section className="panel settings-section account-section" id="account"><div className="settings-title"><span className="settings-icon"><UserRound size={17} /></span><div><h2>Account</h2><p>Authenticated Supabase administrator.</p></div></div><div className="account-row"><span className="account-avatar">{(user?.email || "NA").slice(0, 2).toUpperCase()}</span><span><strong>{user?.user_metadata?.full_name || user?.email || "Administrator"}</strong><small>{user?.email}</small></span><button type="button" className="button button-secondary" onClick={onSignOut}><LogOut size={15} /> Sign out</button></div></section>
        <div className="settings-save-row"><span role={saveError ? "alert" : "status"}>{saved && <><Check size={15} /> Preferences saved on this device</>}{saveError}</span><button className="button button-primary" type="submit"><Save size={16} /> Save preferences</button></div>
      </div>
    </form>
  </>;
}
