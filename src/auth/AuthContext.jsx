/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [authError, setAuthError] = useState("");
  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let receivedAuthEvent = false;
    supabase.auth.getSession().then(({ data, error }) => {
      if (active && !receivedAuthEvent) {
        setSession(data?.session ?? null);
        setAuthError(error?.message || "");
        setLoading(false);
      }
    }).catch((cause) => {
      if (active && !receivedAuthEvent) {
        setAuthError(cause.message || "Unable to restore your session. Please sign in again.");
        setLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthEvent = true;
      setSession(nextSession);
      setAuthError("");
      setLoading(false);
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  const value = { session, user: session?.user ?? null, loading, authError, configured: isSupabaseConfigured };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
