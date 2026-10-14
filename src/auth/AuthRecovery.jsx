import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthRecovery() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const navigate = useNavigate();

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 6) {
      setError("Your password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || "Unable to update your password. Request a new recovery email and try again.");
      } else {
        setSuccess("Your password has been updated. Opening your workspace…");
        window.setTimeout(() => navigate("/dashboard", { replace: true }), 800);
      }
    } catch (cause) {
      setError(cause.message || "Unable to reach Supabase. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <form className="auth-card" onSubmit={submit}>
      <div className="brand auth-brand"><div className="brand-mark"><span /></div><span className="brand-name">nexa<span>.</span></span></div>
      <span className="auth-icon"><LockKeyhole size={19} /></span>
      <p className="eyebrow">ACCOUNT RECOVERY</p>
      <h1>Choose a new password</h1>
      <p className="auth-subtitle">Enter a new password for your NEXA account.</p>
      <label className="form-field">New password<input type="password" autoComplete="new-password" minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 6 characters" /></label>
      <label className="form-field">Confirm new password<input type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {success && <p className="form-success" role="status">{success}</p>}
      <button className="button button-primary auth-submit" disabled={busy}>{busy ? "Updating…" : <>Update password <ArrowRight size={16} /></>}</button>
    </form>
  </main>;
}
