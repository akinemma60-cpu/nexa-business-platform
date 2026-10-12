import { useRef, useState } from "react";
import { ArrowRight, LockKeyhole, UserRoundPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getSignupRedirectTo } from "./signupRedirect";

function authErrorMessage(authError) {
  const code = String(authError.code || "").toLowerCase();
  const message = String(authError.message || "");
  if (code.includes("already_exists") || /already (registered|exists)/i.test(message)) {
    return "An account may already be registered with this email. Sign in, or resend the confirmation email if it is still unverified.";
  }
  return message || "Authentication failed. Please try again.";
}

export default function Login({ initialMode = "login", sessionError = "" }) {
  const signingUp = initialMode === "signup";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [dismissSessionError, setDismissSessionError] = useState(false);
  const emailInput = useRef(null);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    setDismissSessionError(true);

    if (signingUp && !name.trim()) {
      setError("Enter your full name.");
      setBusy(false);
      return;
    }
    if (signingUp && password.length < 6) {
      setError("Your password must be at least 6 characters.");
      setBusy(false);
      return;
    }
    if (signingUp && password !== confirmPassword) {
      setError("Your passwords do not match.");
      setBusy(false);
      return;
    }

    try {
      if (signingUp) {
        const emailRedirectTo = getSignupRedirectTo(import.meta.env.VITE_SITE_URL, window.location);
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            ...(emailRedirectTo ? { emailRedirectTo } : {}),
          },
        });
        if (authError) {
          setError(authErrorMessage(authError));
        } else if (!data.session) {
          setSuccess("Check your email for a confirmation link. If this address is already registered, sign in or resend its confirmation email.");
          setConfirmationPending(true);
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) setError(authErrorMessage(authError));
      }
    } catch (cause) {
      setError(cause.message || "Unable to reach Supabase. Check your connection and project URL.");
    }
    finally { setBusy(false); }
  }

  async function resendConfirmation() {
    const address = email.trim();
    if (!emailInput.current?.validity.valid) {
      setError(address ? "Enter a valid email address first." : "Enter your email address first.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const emailRedirectTo = getSignupRedirectTo(import.meta.env.VITE_SITE_URL, window.location);
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: address,
        options: emailRedirectTo ? { emailRedirectTo } : undefined,
      });
      if (resendError) {
        setError(resendError.message);
      } else {
        setSuccess("If this address has an unconfirmed account, a new confirmation email has been sent. Check your inbox and spam folder.");
      }
    } catch (cause) {
      setError(cause.message || "Unable to resend the confirmation email. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="auth-screen">
    <form className="auth-card" onSubmit={submit}>
      <div className="brand auth-brand"><div className="brand-mark"><span /></div><span className="brand-name">nexa<span>.</span></span></div>
      <span className="auth-icon">{signingUp ? <UserRoundPlus size={19} /> : <LockKeyhole size={19} />}</span>
      <p className="eyebrow">BUSINESS WORKSPACE</p>
      <h1>{signingUp ? "Create your account" : "Welcome back"}</h1>
      <p className="auth-subtitle">{signingUp ? "Start managing your business with NEXA." : "Sign in to manage your business."}</p>
      {signingUp && <label className="form-field">Full name<input type="text" autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>}
      <label className="form-field">Email address<input ref={emailInput} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
      <label className="form-field">Password<input type="password" autoComplete={signingUp ? "new-password" : "current-password"} minLength={signingUp ? 6 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={signingUp ? "At least 6 characters" : "Your password"} /></label>
      {signingUp && <label className="form-field">Confirm password<input type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></label>}
      {(error || (!dismissSessionError && sessionError)) && <p className="form-error" role="alert">{error || sessionError}</p>}
      {success && <p className="form-success" role="status">{success}</p>}
      <button className="button button-primary auth-submit" disabled={busy}>{busy ? signingUp ? "Creating account…" : "Signing in…" : <>{signingUp ? "Create account" : "Sign in"} <ArrowRight size={16} /></>}</button>
      <p className="auth-switch auth-switch-primary">{signingUp ? "Already have an account?" : "New to NEXA?"} <Link to={signingUp ? "/login" : "/signup"}>{signingUp ? "Sign in" : "Create account"}</Link></p>
      {(!signingUp || confirmationPending) && <p className="auth-switch">{!signingUp && "Didn't receive a confirmation email?"} <button type="button" disabled={busy} onClick={resendConfirmation}>{busy ? "Sending…" : "Resend confirmation email"}</button></p>}
      <p className="auth-footnote">Your business data is private to your account.</p>
    </form>
  </main>;
}
