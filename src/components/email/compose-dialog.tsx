"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Send, Mail, AlertTriangle, FileText } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useGmailStatus } from "@/hooks/use-gmail-status"

interface ComposeEmailDialogProps {
  open: boolean
  onClose: () => void
  /** Pre-fill recipient from contact */
  contact?: { name?: string; email?: string; id: string }
  /** Link to a deal (for proposals) */
  deal?: {
    id: string
    title: string
    value: number
    currency?: string
    stageName?: string
  }
  /** Reply to an existing thread */
  replyTo?: { threadId: string; subject: string; messageId: string }
  /** Called after a successful send */
  onSent?: () => void
}

function formatCurrency(value: number, currency?: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function ComposeEmailDialog({
  open,
  onClose,
  contact,
  deal,
  replyTo,
  onSent,
}: ComposeEmailDialogProps) {
  const gmail = useGmailStatus()

  const [to, setTo] = useState(contact?.email ?? "")
  const [subject, setSubject] = useState(
    replyTo
      ? `Re: ${replyTo.subject}`
      : deal
        ? `Proposal: ${deal.title}`
        : "",
  )
  const [body, setBody] = useState("")
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [showCcBcc, setShowCcBcc] = useState(false)
  const [useProposal, setUseProposal] = useState(false)
  const [sending, setSending] = useState(false)

  // Reset form when opening
  function resetForm() {
    setTo(contact?.email ?? "")
    setSubject(
      replyTo
        ? `Re: ${replyTo.subject}`
        : deal
          ? `Proposal: ${deal.title}`
          : "",
    )
    setBody("")
    setCc("")
    setBcc("")
    setShowCcBcc(false)
    setUseProposal(false)
  }

  function buildProposalHtml(): string {
    if (!deal) return ""
    const contactName = contact?.name ?? "there"
    return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Hi ${contactName},</p>
  <p>Please find below the details for <strong>${deal.title}</strong>:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 12px; color: #64748b; font-size: 14px;">Deal</td>
      <td style="padding: 8px 12px; font-weight: 600;">${deal.title}</td>
    </tr>
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 12px; color: #64748b; font-size: 14px;">Amount</td>
      <td style="padding: 8px 12px; font-weight: 600; color: #22c55e;">${formatCurrency(deal.value, deal.currency)}</td>
    </tr>
    ${
      deal.stageName
        ? `<tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 8px 12px; color: #64748b; font-size: 14px;">Stage</td>
      <td style="padding: 8px 12px;">${deal.stageName}</td>
    </tr>`
        : ""
    }
  </table>
  ${body ? `<p>${body.replace(/\n/g, "<br>")}</p>` : ""}
  <p>Looking forward to your response.</p>
  <p>Best regards</p>
</div>`.trim()
  }

  function buildProposalText(): string {
    if (!deal) return body
    const contactName = contact?.name ?? "there"
    const lines = [
      `Hi ${contactName},`,
      "",
      `Please find below the details for ${deal.title}:`,
      "",
      `  Deal: ${deal.title}`,
      `  Amount: ${formatCurrency(deal.value, deal.currency)}`,
    ]
    if (deal.stageName) lines.push(`  Stage: ${deal.stageName}`)
    lines.push("")
    if (body) lines.push(body, "")
    lines.push("Looking forward to your response.", "", "Best regards")
    return lines.join("\n")
  }

  async function handleSend() {
    if (!to.includes("@")) {
      toast.error("Please enter a valid email address")
      return
    }
    if (!subject.trim()) {
      toast.error("Subject is required")
      return
    }
    if (!body.trim() && !useProposal) {
      toast.error("Email body is required")
      return
    }

    setSending(true)
    try {
      const payload: Record<string, unknown> = {
        to: to
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean),
        subject: subject.trim(),
        body_text: useProposal ? buildProposalText() : body.trim(),
        contact_id: contact?.id,
        deal_id: deal?.id,
      }

      if (useProposal) {
        payload.body_html = buildProposalHtml()
      }

      if (cc.trim()) {
        payload.cc = cc
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
      }
      if (bcc.trim()) {
        payload.bcc = bcc
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean)
      }

      if (replyTo) {
        payload.thread_id = replyTo.threadId
        payload.in_reply_to = replyTo.messageId
      }

      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Send failed")
      }

      toast.success("Email sent successfully")
      resetForm()
      onSent?.()
      onClose()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to send email",
      )
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          resetForm()
          onClose()
        }
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg border-slate-800 bg-slate-900 p-0 flex flex-col gap-0"
      >
        <SheetHeader className="shrink-0 border-b border-slate-700/50 px-4 py-3">
          <SheetTitle className="text-white text-base flex items-center gap-2">
            <Mail className="size-4" />
            {replyTo ? "Reply" : useProposal ? "Send Proposal" : "Compose Email"}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Gmail not connected warning */}
          {!gmail.loading && !gmail.connected && (
            <Alert className="border-amber-500/30 bg-amber-500/5">
              <AlertTriangle className="size-4 text-amber-400" />
              <AlertDescription className="text-sm text-slate-300">
                Gmail is not configured.{" "}
                {gmail.configured
                  ? "Ask your admin to connect it in Settings."
                  : "Add Google OAuth credentials to your environment first."}
              </AlertDescription>
            </Alert>
          )}

          {/* Connected as */}
          {gmail.connected && gmail.email && (
            <p className="text-[11px] text-slate-500">
              Sending as <span className="text-slate-300">{gmail.email}</span>
            </p>
          )}

          {/* To */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">To</Label>
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
            />
          </div>

          {/* CC/BCC toggle */}
          {!showCcBcc && (
            <button
              type="button"
              onClick={() => setShowCcBcc(true)}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              Add CC / BCC
            </button>
          )}
          {showCcBcc && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">CC</Label>
                <Input
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  placeholder="cc@example.com"
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-400">BCC</Label>
                <Input
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  placeholder="bcc@example.com"
                  className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
                />
              </div>
            </>
          )}

          {/* Subject */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">Subject</Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
              className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-500"
            />
          </div>

          {/* Proposal template toggle */}
          {deal && (
            <button
              type="button"
              onClick={() => setUseProposal((p) => !p)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                useProposal
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              <FileText className="size-3" />
              {useProposal ? "Proposal template active" : "Use proposal template"}
            </button>
          )}

          {/* Proposal preview */}
          {useProposal && deal && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-xs text-slate-300 space-y-1">
              <p className="font-medium text-slate-200">Proposal preview:</p>
              <p>Deal: {deal.title}</p>
              <p>Amount: {formatCurrency(deal.value, deal.currency)}</p>
              {deal.stageName && <p>Stage: {deal.stageName}</p>}
              <p className="text-slate-500 mt-2">
                Add a personal message below to include in the proposal.
              </p>
            </div>
          )}

          {/* Body */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">
              {useProposal ? "Personal message (optional)" : "Message"}
            </Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                useProposal
                  ? "Add a personal note to the proposal..."
                  : "Write your email..."
              }
              className="min-h-[140px] resize-none border-slate-700 bg-slate-800 text-sm text-white placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-slate-700/50 px-4 py-3 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetForm()
              onClose()
            }}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSend}
            disabled={sending || gmail.loading || !gmail.connected}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {(sending || gmail.loading) ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            {gmail.loading ? 'Connecting…' : 'Send Email'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
