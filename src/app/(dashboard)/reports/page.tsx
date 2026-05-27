"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getVisibleProfileIds } from "@/lib/reports/visible-profiles";
import { ReportFilters, defaultDateRange } from "@/components/reports/report-filters";
import type { DateRange } from "@/components/reports/report-filters";
import { DealConversionReport } from "@/components/reports/deal-conversion-report";
import { DealLostReport } from "@/components/reports/deal-lost-report";
import { FollowupReport } from "@/components/reports/followup-report";
import { EmployeeReport } from "@/components/reports/employee-report";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BarChart2, TrendingUp, XCircle, MessageSquare, Users } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

const TAB_VALUES = ["deal-conversion", "deal-lost", "followup", "employee"] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTab(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

export default function ReportsPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryTab = searchParams.get("tab");
  const tab: TabValue = isTab(queryTab) ? queryTab : "deal-conversion";

  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [range, setRange] = useState<DateRange>(defaultDateRange());
  const [loadingIds, setLoadingIds] = useState(true);

  // Load visible profile IDs once the current profile is known
  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    setLoadingIds(true);
    (async () => {
      const ids = await getVisibleProfileIds(supabase, profile.id, profile.role ?? 'executive');
      if (!cancelled) {
        setVisibleIds(ids);
        setLoadingIds(false);
      }
    })();
    return () => { cancelled = true; };
  }, [profile, supabase]);

  // Emit initial range once on mount
  useEffect(() => {
    setRange(defaultDateRange());
  }, []);

  function handleTabChange(value: TabValue) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", value);
    router.replace(`/reports?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-white">
            <BarChart2 className="size-6 text-primary" />
            Reports
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Insights scoped to your role — data updates as you change the period.
          </p>
        </div>
        <ReportFilters onChange={setRange} />
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(v) => handleTabChange(v as TabValue)}>
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger
            value="deal-conversion"
            className="data-[state=active]:bg-slate-800 data-[state=active]:text-primary text-slate-400"
          >
            <TrendingUp className="size-4" />
            Deal Conversion
          </TabsTrigger>
          <TabsTrigger
            value="deal-lost"
            className="data-[state=active]:bg-slate-800 data-[state=active]:text-primary text-slate-400"
          >
            <XCircle className="size-4" />
            Deal Lost
          </TabsTrigger>
          <TabsTrigger
            value="followup"
            className="data-[state=active]:bg-slate-800 data-[state=active]:text-primary text-slate-400"
          >
            <MessageSquare className="size-4" />
            Follow-up
          </TabsTrigger>
          <TabsTrigger
            value="employee"
            className="data-[state=active]:bg-slate-800 data-[state=active]:text-primary text-slate-400"
          >
            <Users className="size-4" />
            Employee
          </TabsTrigger>
        </TabsList>

        {loadingIds ? (
          <div className="flex items-center justify-center py-20">
            <div className="size-6 animate-spin rounded-full border-2 border-slate-700 border-t-primary" />
          </div>
        ) : (
          <>
            <TabsContent value="deal-conversion" className="mt-4">
              <DealConversionReport visibleIds={visibleIds} range={range} />
            </TabsContent>

            <TabsContent value="deal-lost" className="mt-4">
              <DealLostReport visibleIds={visibleIds} range={range} />
            </TabsContent>

            <TabsContent value="followup" className="mt-4">
              <FollowupReport visibleIds={visibleIds} range={range} />
            </TabsContent>

            <TabsContent value="employee" className="mt-4">
              <EmployeeReport visibleIds={visibleIds} range={range} />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
