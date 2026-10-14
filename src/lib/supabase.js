import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./supabaseConfig.js";

const config = getSupabaseConfig({
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
});

export const isSupabaseConfigured = config.configured;
export const supabaseConfigIssue = config.reason;
export const supabase = isSupabaseConfigured
  ? createClient(config.url, config.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
