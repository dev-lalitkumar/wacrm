"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { Company } from "@/types";

interface CompanyContextValue {
  company: Company | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    setCompany((data as Company | null) ?? null);
    setLoading(false);
  }, [supabase]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Realtime — broadcast company updates across tabs so the sidebar
  // flips immediately when an admin saves new branding.
  useEffect(() => {
    const channel = supabase
      .channel("companies-singleton")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "companies", filter: "id=eq.1" },
        () => { refresh(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, refresh]);

  return (
    <CompanyContext.Provider value={{ company, loading, refresh }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    // Tolerant fallback for unmounted contexts (storybook, tests) —
    // return a stable empty shape so callers don't have to null-check
    // their hook usage.
    return { company: null, loading: false, refresh: async () => {} };
  }
  return ctx;
}
