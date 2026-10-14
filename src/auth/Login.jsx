import { useEffect, useRef, useState } from "react";
import { ArrowRight, LockKeyhole, UserRoundPlus } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import { getAuthCallbackError, getAuthErrorMessage, getResendCooldownSeconds } from "./authMessages";
import { requestPasswordReset, resendSignupConfirmation, signInWithEmailPassword, signUpWithEmailPassword } from "./authRequests";
import { getSignupRedirectTo } from "./signupRedirect";

export default function Login({ initialMode = "login", sessionError = "", confirmationSuccess = false }) {
  const { beginSignupAttempt, endSignupAttempt, dismissEmailConfirmationNotice } = useAuth();
  const signingUp = initialMode === "signup";
  const [resettingPassword, setResettingPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [callbackError, setCallbackError] = useState(() => getAuthCallbackError(window.location.search, window.location.hash));
  const [confirmationPending, setConfirmationPending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [dismissSessionError, setDismissSessionError] = useState(false);
  const emailInput = useRef(null);

  useEffect(() => {
    if (!callbackError) return;
    const callbackUrl = new URL(window.location.href);
    ["error", "error_code", "error_description"].forEach((key) => callbackUrl.searchParams.delete(key));
    const hashParams = new URLSearchParams(callbackUrl.hash.slice(1));
    ["error", "error_code", "error_description"].forEach((key) => hashParams.delete(key));
    callbackUrl.hash = hashParams.toString();
    window.history.replaceState(window.history.state, "", `${callbackUrl.pathname}${callbackUrl.search}${callbackUrl.hash}`);
  }, [callbackError]);

  useEffect(() => {
    if (!resendCooldown) return undefined;
    const timer = window.setInterval(() => setResendCooldown((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    setCallbackError("");
    dismissEmailConfirmationNotice();
    setDismissSessionError(true);

    if (!emailInput.current?.validity.valid) {
      setError("Enter a valid email address.");
      setBusy(false);
      return;
    }
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

    let signupAttemptStarted = false;
    try {
      if (resettingPassword) {
        const redirectTo = getSignupRedirectTo(import.meta.env.VITE_SITE_URL, window.location);
        const { error: resetError } = await requestPasswordReset(supabase.auth, email.trim(), redirectTo);
        if (resetError) {
          setError("Unable to request a password reset right now. Check your connection and try again.");
        } else {
          setSuccess("If an account can be recovered with this email, a password reset message will arrive shortly. Check your inbox and spam folder.");
        }
      } else if (signingUp) {
        beginSignupAttempt();
        signupAttemptStarted = true;
        const emailRedirectTo = getSignupRedirectTo(import.meta.env.VITE_SITE_URL, window.location);
        const address = email.trim();
        const { data, error: signupError } = await signUpWithEmailPassword(supabase.auth, {
          email: address,
          password,
          fullName: name.trim(),
          emailRedirectTo,
        });
        if (signupError) {
          setError(getAuthErrorMessage(signupError));
        } else if (!data.session) {
          setConfirmationPending(true);
          setSuccess("Account created. Check your email and click the confirmation link to verify your address, then return here to sign in.");
        } else {
          const { error: signOutError } = await supabase.auth.signOut();
          setError(signOutError?.message || "Email confirmation is disabled in Supabase. Enable email confirmation before allowing account signup.");
        }
      } else {
        const { error: signinError } = await signInWithEmailPassword(supabase.auth, email.trim(), password);
        if (signinError) setError(getAuthErrorMessage(signinError));
      }
    } catch (cause) {
      setError(cause.message || "Unable to reach Supabase. Check your connection and project URL.");
    } finally {
      if (signupAttemptStarted) endSignupAttempt();
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError(address ? "Enter a valid email address first." : "Enter your email address first.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const emailRedirectTo = getSignupRedirectTo(import.meta.env.VITE_SITE_URL, window.location);
      const { error: resendError } = await resendSignupConfirmation(supabase.auth, address, emailRedirectTo);
      if (resendError) {
        const cooldown = getResendCooldownSeconds(resendError);
        if (cooldown) {
          setResendCooldown(cooldown);
          setError(`Too many email requests. Please wait ${cooldown} seconds before trying again.`);
        } else {
          setError("Unable to send a confirmation email right now. If you have already confirmed, sign in or use Forgot password; otherwise try again shortly.");
        }
      } else {
        setResendCooldown(60);
        setSuccess("If this address needs verification, a new confirmation email has been sent. Check your inbox and spam folder, and use the newest message.");
      }
    } catch (cause) {
      setError(cause.message || "Unable to resend the confirmation email. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const heading = resettingPassword ? "Reset your password" : signingUp ? "Create your account" : "Welcome back";
  const subtitle = resettingPassword
    ? "We'll send recovery instructions if this email can be used to recover an account."
    : signingUp ? "Start managing your business with NEXA." : "Sign in to manage your business.";
  const displayedError = error || callbackError || (!dismissSessionError && sessionError ? getAuthErrorMessage({ message: sessionError }) : "");

  return <main className="auth-screen">
    <form className="auth-card" onSubmit={submit}>
      <div className="brand auth-brand"><div className="brand-mark"><span /></div><span className="brand-name">nexa<span>.</span></span></div>
      <span className="auth-icon">{signingUp ? <UserRoundPlus size={19} /> : <LockKeyhole size={19} />}</span>
      <p className="eyebrow">BUSINESS WORKSPACE</p>
      <h1>{heading}</h1>
      <p className="auth-subtitle">{subtitle}</p>
      {confirmationSuccess && <p className="form-success" role="status">Your email has been confirmed. Sign in with your email and password to continue.</p>}
      {signingUp && <label className="form-field">Full name<input type="text" autoComplete="name" required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" /></label>}
      <label className="form-field">Email address<input ref={emailInput} type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
      {!resettingPassword && <label className="form-field">Password<input type="password" autoComplete={signingUp ? "new-password" : "current-password"} minLength={signingUp ? 6 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={signingUp ? "At least 6 characters" : "Your password"} /></label>}
      {signingUp && <label className="form-field">Confirm password<input type="password" autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter your password again" /></label>}
      {displayedError && <p className="form-error" role="alert">{displayedError}</p>}
      {success && <p className="form-success" role="status">{success}</p>}
      <button className="button button-primary auth-submit" disabled={busy}>{busy ? "Please wait…" : <>{resettingPassword ? "Send recovery email" : signingUp ? "Create account" : "Sign in"} <ArrowRight size={16} /></>}</button>
      {resettingPassword
        ? <p className="auth-switch auth-switch-primary"><button type="button" onClick={() => { setResettingPassword(false); setError(""); setSuccess(""); }}>Back to sign in</button></p>
        : <p className="auth-switch auth-switch-primary">{signingUp ? "Already have an account?" : "New to NEXA?"} <Link to={signingUp ? "/login" : "/signup"}>{signingUp ? "Sign in" : "Create account"}</Link></p>}
      {!signingUp && !resettingPassword && <p className="auth-switch"><button type="button" disabled={busy} onClick={() => { setResettingPassword(true); setError(""); setSuccess(""); }}>Forgot password?</button></p>}
      {(!signingUp || confirmationPending) && !resettingPassword && <p className="auth-switch">{signingUp ? "Didn't receive the confirmation email?" : "Need another confirmation email?"} <button type="button" disabled={busy || resendCooldown > 0} onClick={resendConfirmation}>{busy ? "Sending…" : resendCooldown ? `Try again in ${resendCooldown}s` : "Resend confirmation email"}</button></p>}
      <p className="auth-footnote">Your business data is private to your account.</p>
    </form>
  </main>;
}
