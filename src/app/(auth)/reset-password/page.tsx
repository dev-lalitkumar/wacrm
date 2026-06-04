"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const MIN_PASSWORD = 8;

/**
 * Password-recovery screen. Reached after /auth/callback exchanges the email
 * link's code for a (recovery) session — so we can set a new password via
 * updateUser() WITHOUT asking for the old one (the user forgot it).
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Confirm a recovery session exists (the callback should have set it).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled) {
        setHasSession(!!data.session);
        setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (next.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters`);
      return;
    }
    if (next !== confirm) {
      setError("New password and confirmation do not match");
      return;
    }
    setSaving(true);
    const { error: updErr } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (updErr) {
      setError(updErr.message);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md border-slate-800 bg-slate-900">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl text-white">Choose a new password</CardTitle>
          <CardDescription className="text-slate-400">
            Enter a new password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {checking ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-slate-500" />
            </div>
          ) : !hasSession ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                This reset link is invalid or has expired. Please request a new one.
              </div>
              <Link href="/forgot-password">
                <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Request a new link
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <Label htmlFor="next" className="text-slate-300">New password</Label>
                <Input
                  id="next"
                  type="password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD}
                  required
                  disabled={saving}
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm" className="text-slate-300">Confirm new password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  minLength={MIN_PASSWORD}
                  required
                  disabled={saving}
                  className="border-slate-700 bg-slate-800 text-white"
                />
              </div>
              <Button
                type="submit"
                disabled={saving || !next || !confirm}
                className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <><Loader2 className="size-4 animate-spin" /> Updating…</> : "Update password"}
              </Button>
            </form>
          )}

          <Link
            href="/login"
            className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-slate-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
