/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase, supabaseConfigIssue } from "../lib/supabase";
import { isSignupConfirmationCallback } from "./authMessages";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState("");
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [emailConfirmationComplete, setEmailConfirmationComplete] = useState(false);
  const signupAttemptInProgress = useRef(false);
  const signupConfirmationCallback = useRef(
    isSignupConfirmationCallback(window.location.search, window.location.hash),
  );
  function beginSignupAttempt() {
    signupAttemptInProgress.current = true;
  }
  function endSignupAttempt() {
    signupAttemptInProgress.current = false;
  }
  function dismissEmailConfirmationNotice() {
    setEmailConfirmationComplete(false);
  }

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    const urlParams = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`);
    const recoveryRedirect = urlParams.get("type") === "recovery";
    const signupConfirmationRedirect = signupConfirmationCallback.current;
    let confirmationHandled = false;

    async function completeConfirmation() {
      if (!active || confirmationHandled) return;
      confirmationHandled = true;
      setEmailConfirmationComplete(true);
      setSession(null);
      setLoading(false);
      window.setTimeout(async () => {
        try {
          const { error } = await supabase.auth.signOut();
          if (active && error) setAuthError("Your email is confirmed, but NEXA could not clear the callback session. Sign out, then sign in again.");
        } catch {
          if (active) setAuthError("Your email is confirmed, but NEXA could not clear the callback session. Sign out, then sign in again.");
        }
      }, 0);
    }

    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !receivedAuthEvent && !signupAttemptInProgress.current) {
        if (signupConfirmationRedirect && data?.session) {
          void completeConfirmation();
        } else {
          setSession(data?.session ?? null);
          setAuthError(error?.message || "");
          setPasswordRecovery(Boolean(data?.session && recoveryRedirect));
          setLoading(false);
        }
      }
    }).catch((cause) => {
      if (active && !receivedAuthEvent) {
        setAuthError(cause.message || "Unable to restore your session. Please sign in again.");
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      receivedAuthEvent = true;
      if (signupConfirmationRedirect && ["SIGNED_IN", "INITIAL_SESSION"].includes(event) && nextSession) {
        void completeConfirmation();
        return;
      }
      if (signupAttemptInProgress.current && event === "SIGNED_IN") {
        setLoading(false);
        return;
      }
      setSession(nextSession);
      setAuthError("");
      if (event === "PASSWORD_RECOVERY" || (event === "INITIAL_SESSION" && recoveryRedirect && nextSession)) setPasswordRecovery(true);
      if (event === "SIGNED_OUT" || event === "USER_UPDATED") setPasswordRecovery(false);
      setLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    loading,
    authError,
    passwordRecovery,
    emailConfirmationComplete,
    beginSignupAttempt,
    endSignupAttempt,
    dismissEmailConfirmationNotice,
    configured: isSupabaseConfigured,
    configIssue: supabaseConfigIssue,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
