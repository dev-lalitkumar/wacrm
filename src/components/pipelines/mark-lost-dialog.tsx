"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { LostReason } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface MarkLostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the selected reasonId when the user confirms */
  onConfirm: (reasonId: string) => Promise<void>;
}

export function MarkLostDialog({
  open,
  onOpenChange,
  onConfirm,
}: MarkLostDialogProps) {
  const supabase = createClient();

  const [reasons, setReasons] = useState<LostReason[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Fetch reasons whenever dialog opens
  useEffect(() => {
    if (!open) return;
    setSelectedId("");
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("lost_reasons")
        .select("*")
        .order("sort_order")
        .order("reason");
      if (cancelled) return;
      if (error) {
        toast.error("Failed to load lost reasons");
      } else {
        setReasons((data ?? []) as LostReason[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, supabase]);

  async function handleConfirm() {
    if (!selectedId) return;
    setConfirming(true);
    try {
      await onConfirm(selectedId);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark deal as lost");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white">Mark Deal as Lost</DialogTitle>
          <DialogDescription className="text-slate-400">
            Select a reason for losing this deal. This cannot be skipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading reasons…
            </div>
          ) : reasons.length === 0 ? (
            <p className="text-sm text-slate-500">
              No lost reasons configured. Ask your admin to add some in Settings → Lost Reasons.
            </p>
          ) : (
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label
                  key={r.id}
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
                    selectedId === r.id
                      ? "border-red-500/60 bg-red-500/10 text-white"
                      : "border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800 hover:border-slate-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="lost-reason"
                    value={r.id}
                    checked={selectedId === r.id}
                    onChange={() => setSelectedId(r.id)}
                    className="accent-red-500"
                  />
                  <span className="text-sm">{r.reason}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
            disabled={confirming}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedId || confirming || loading}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {confirming && <Loader2 className="size-4 animate-spin mr-1" />}
            Confirm Lost
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
