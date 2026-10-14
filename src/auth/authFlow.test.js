import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { getAuthCallbackError, getAuthErrorMessage, getResendCooldownSeconds, isSignupConfirmationCallback } from "./authMessages.js";
import { requestPasswordReset, resendSignupConfirmation, signInWithEmailPassword, signUpWithEmailPassword, updateSignedInPassword } from "./authRequests.js";
import { getSignupRedirectTo } from "./signupRedirect.js";
import { getSupabaseConfig } from "../lib/supabaseConfig.js";

test("Supabase configuration requires both a valid absolute project URL and a public key", () => {
  assert.deepEqual(getSupabaseConfig({}), { configured: false, reason: "missing-url" });
  assert.deepEqual(getSupabaseConfig({ url: "https://project.supabase.co" }), { configured: false, reason: "missing-key" });
  assert.deepEqual(getSupabaseConfig({ url: "not-a-url", publishableKey: "public-key" }), { configured: false, reason: "invalid-url" });
  assert.equal(getSupabaseConfig({ url: "https://project.supabase.co", publishableKey: " public-key " }).configured, true);
});

test("blank publishable keys fall back to the supported legacy anon key", () => {
  assert.deepEqual(
    getSupabaseConfig({ url: "https://project.supabase.co", publishableKey: "  ", anonKey: " legacy-anon-key " }),
    { configured: true, reason: "", url: "https://project.supabase.co", key: "legacy-anon-key" },
  );
});

test("signup confirmation redirects use the configured production login route", () => {
  assert.equal(
    getSignupRedirectTo("https://spontaneous-hotteok-73c234.netlify.app", { hostname: "localhost" }),
    "https://spontaneous-hotteok-73c234.netlify.app/login",
  );
});

test("signup redirects use the current production origin when no site URL is configured", () => {
  assert.equal(
    getSignupRedirectTo("", { hostname: "spontaneous-hotteok-73c234.netlify.app", origin: "https://spontaneous-hotteok-73c234.netlify.app" }),
    "https://spontaneous-hotteok-73c234.netlify.app/login",
  );
});

test("local signup redirects defer to Supabase when no local site URL is configured", () => {
  assert.equal(getSignupRedirectTo("", { hostname: "localhost" }), undefined);
});

test("Netlify serves direct auth-route requests through the SPA entry point", () => {
  const redirectsPath = fileURLToPath(new URL("../../public/_redirects", import.meta.url));
  assert.match(readFileSync(redirectsPath, "utf8"), /^\/\*\s+\/index\.html\s+200\s*$/m);
});

test("confirmation callback success is recognized from Supabase URL fragments and query strings", () => {
  assert.equal(isSignupConfirmationCallback("", "#access_token=access&refresh_token=refresh&type=signup"), true);
  assert.equal(isSignupConfirmationCallback("?type=signup", ""), true);
  assert.equal(isSignupConfirmationCallback("#type=recovery", ""), false);
  assert.equal(isSignupConfirmationCallback("", ""), false);
});

test("expired, invalid, and generic confirmation callback errors provide recovery guidance", () => {
  assert.match(getAuthCallbackError("?error=access_denied&error_code=otp_expired"), /expired or has already been used/i);
  assert.match(getAuthCallbackError("", "#error=access_denied&error_description=Invalid+token"), /invalid or has already been used/i);
  assert.match(getAuthCallbackError("?error=access_denied"), /Request a new confirmation email/i);
  assert.equal(getAuthCallbackError(""), "");
});

test("signup keeps email and password and requests Supabase's standard confirmation email", async () => {
  let received;
  const auth = { signUp: async (options) => { received = options; return { data: { user: {}, session: null }, error: null }; } };
  const response = await signUpWithEmailPassword(auth, {
    email: "person@example.com",
    password: "secret-pass",
    fullName: "Nexa User",
    emailRedirectTo: "https://spontaneous-hotteok-73c234.netlify.app/login",
  });

  assert.equal(received.email, "person@example.com");
  assert.equal(received.password, "secret-pass");
  assert.deepEqual(received.options.data, { full_name: "Nexa User" });
  assert.equal(received.options.emailRedirectTo, "https://spontaneous-hotteok-73c234.netlify.app/login");
  assert.equal(response.data.session, null);
});

test("password login calls Supabase signInWithPassword", async () => {
  let received;
  const auth = { signInWithPassword: async (credentials) => { received = credentials; return { data: { session: { user: {} } }, error: null }; } };
  const response = await signInWithEmailPassword(auth, "person@example.com", "secret-pass");

  assert.deepEqual(received, { email: "person@example.com", password: "secret-pass" });
  assert.ok(response.data.session);
});

test("resend sends a link-based signup confirmation with the expected redirect", async () => {
  let received;
  const auth = { resend: async (options) => { received = options; return { error: null }; } };
  const response = await resendSignupConfirmation(auth, "person@example.com", "https://spontaneous-hotteok-73c234.netlify.app/login");

  assert.deepEqual(received, {
    type: "signup",
    email: "person@example.com",
    options: { emailRedirectTo: "https://spontaneous-hotteok-73c234.netlify.app/login" },
  });
  assert.equal(response.error, null);
});

test("resend cooldown recognizes Supabase rate limit responses", () => {
  assert.equal(getResendCooldownSeconds({ message: "For security purposes, retry after 42 seconds" }), 42);
  assert.equal(getResendCooldownSeconds({ code: "over_email_send_rate_limit" }), 60);
  assert.equal(getResendCooldownSeconds({ message: "Network unavailable" }), 0);
});

test("password recovery keeps its redirect and uses resetPasswordForEmail", async () => {
  let received;
  const auth = { resetPasswordForEmail: async (...options) => { received = options; return { error: null }; } };
  const response = await requestPasswordReset(auth, "person@example.com", "https://spontaneous-hotteok-73c234.netlify.app/login");

  assert.deepEqual(received, ["person@example.com", { redirectTo: "https://spontaneous-hotteok-73c234.netlify.app/login" }]);
  assert.equal(response.error, null);
});

test("signed-in password changes use Supabase updateUser", async () => {
  let received;
  const auth = { updateUser: async (attributes) => { received = attributes; return { data: { user: {} }, error: null }; } };
  const response = await updateSignedInPassword(auth, "new-secure-password");
  assert.deepEqual(received, { password: "new-secure-password" });
  assert.equal(response.error, null);
});

test("signup, login, and unverified-account errors provide safe guidance", () => {
  assert.match(getAuthErrorMessage({ code: "email_not_confirmed" }), /Confirm your email before signing in/i);
  assert.match(getAuthErrorMessage({ message: "User already registered" }), /try signing in or use Forgot password/i);
  assert.match(getAuthErrorMessage({ message: "Invalid login credentials" }), /Email or password is incorrect/i);
});
