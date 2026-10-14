export function getAuthCallbackError(search = "", hash = "") {
  const params = new URLSearchParams([search, hash].map((part) => part.replace(/^[?#]/, "")).filter(Boolean).join("&"));
  const code = [params.get("error_code"), params.get("error")].filter(Boolean).join(" ").toLowerCase();
  const description = (params.get("error_description") || "").toLowerCase();
  if (!code && !description) return "";

  if (/expired|otp_expired|already.used/.test(`${code} ${description}`)) {
    return "This confirmation link has expired or has already been used. Request a new confirmation email below; do not refresh the old link.";
  }
  if (/invalid|otp_invalid|token/.test(`${code} ${description}`)) {
    return "This confirmation link is invalid or has already been used. Request a new confirmation email below.";
  }
  return "We couldn't complete email verification. Request a new confirmation email below, or sign in if you have already verified your account.";
}

export function isSignupConfirmationCallback(search = "", hash = "") {
  return new URLSearchParams(`${search}&${hash.replace(/^#/, "")}`).get("type") === "signup";
}

export function getResendCooldownSeconds(error) {
  const message = String(error?.message || "");
  const code = String(error?.code || "").toLowerCase();
  const seconds = message.match(/(\d+)\s*seconds?\b/i);
  if (seconds) return Number(seconds[1]);
  return /rate.?limit|over_email_send_rate_limit/i.test(`${code} ${message}`) ? 60 : 0;
}

export function getAuthErrorMessage(authError) {
  const code = String(authError?.code || "").toLowerCase();
  const message = String(authError?.message || "");
  if (/otp_expired|expired/.test(`${code} ${message}`)) {
    return "This confirmation link has expired or has already been used. Request a new confirmation email.";
  }
  if (/otp_invalid|invalid.*token/.test(`${code} ${message}`)) {
    return "This confirmation link is invalid or has already been used. Request a new confirmation email.";
  }
  if (code.includes("already_exists") || /already (registered|exists)/i.test(message)) {
    return "We couldn't create an account with those details. If you already have an account, try signing in or use Forgot password.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(message)) {
    return "Confirm your email before signing in. Request a new confirmation email if needed.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Email or password is incorrect. If you have not confirmed your email yet, request a new confirmation email.";
  }
  return message || "Authentication failed. Please try again.";
}
