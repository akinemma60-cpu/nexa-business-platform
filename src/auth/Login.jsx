import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) setError(authError.message);
    } catch (cause) { setError(cause.message || "Unable to reach Supabase. Check your connection and project URL."); }
    finally { setBusy(false); }
  }
  return <main className="auth-screen"><form className="auth-card" onSubmit={submit}><div className="brand auth-brand"><div className="brand-mark"><span /></div><span className="brand-name">nexa<span>.</span></span></div><span className="auth-icon"><LockKeyhole size={19} /></span><p className="eyebrow">ADMIN WORKSPACE</p><h1>Welcome back</h1><p className="auth-subtitle">Sign in to manage your business.</p><label className="form-field">Email address<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></label><label className="form-field">Password<input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary auth-submit" disabled={busy}>{busy ? "Signing in…" : <>Sign in <ArrowRight size={16} /></>}</button><p className="auth-footnote">Admin access is managed through Supabase Auth.</p></form></main>;
}
