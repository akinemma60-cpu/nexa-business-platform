/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { loadBusinessData } from "../lib/api";

const DataContext = createContext(null);
export function BusinessDataProvider({ children }) {
  const { user } = useAuth();
  const [data, setData] = useState({ products: [], customers: [], orders: [] });
  const [ownerId, setOwnerId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorOwnerId, setErrorOwnerId] = useState(null);
  const requestId = useRef(0);
  const userId = user?.id;
  const reload = useCallback(async () => {
    if (!userId) return;
    const currentRequest = ++requestId.current;
    setLoading(true); setError(""); setErrorOwnerId(null);
    try {
      const next = await loadBusinessData();
      if (currentRequest !== requestId.current) return false;
      setData(next); setOwnerId(userId);
      return true;
    } catch (cause) {
      if (currentRequest === requestId.current) { setError(cause.message || "Unable to load your business data."); setErrorOwnerId(userId); }
      return false;
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [userId]);
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    const currentRequest = ++requestId.current;
    loadBusinessData().then((next) => {
      if (active && currentRequest === requestId.current) { setData(next); setOwnerId(userId); setError(""); setErrorOwnerId(null); }
    }).catch((cause) => {
      if (active && currentRequest === requestId.current) { setError(cause.message || "Unable to load your business data."); setErrorOwnerId(userId); }
    }).finally(() => {
      if (active && currentRequest === requestId.current) setLoading(false);
    });
    return () => { active = false; if (currentRequest === requestId.current) requestId.current += 1; };
  }, [userId]);
  const visibleData = ownerId === userId ? data : { products: [], customers: [], orders: [] };
  const visibleError = errorOwnerId === userId ? error : "";
  return <DataContext.Provider value={{ ...visibleData, loading: loading || (Boolean(userId) && ownerId !== userId && !visibleError), error: visibleError, reload }}>{children}</DataContext.Provider>;
}
export function useBusinessData() {
  const context = useContext(DataContext);
  if (!context) throw new Error("useBusinessData must be used within BusinessDataProvider");
  return context;
}
