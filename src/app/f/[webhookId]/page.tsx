'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, CheckCircle2 } from 'lucide-react'

/**
 * Public, embeddable lead form. Posts to /api/forms/[webhookId], which only
 * accepts submissions when the webhook has public_form_enabled = true.
 * No auth, no secret — protected by a honeypot + per-webhook rate limit.
 */
export default function PublicLeadFormPage() {
  const params = useParams<{ webhookId: string }>()
  const webhookId = params.webhookId

  const [form, setForm] = useState({ name: '', phone: '', email: '', company: '', message: '', website: '' })
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(key: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!form.phone.trim() && !form.email.trim()) {
      setError('Please provide a phone number or email.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/forms/${webhookId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        setError(json?.error || 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setDone(true)
    } catch {
      setError('Network error. Please try again.')
    }
    setSubmitting(false)
  }

  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900'

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm border border-slate-200">
        {done ? (
          <div className="flex flex-col items-center py-8 text-center">
            <CheckCircle2 className="size-12 text-green-500" />
            <h1 className="mt-3 text-xl font-bold text-slate-900">Thank you!</h1>
            <p className="mt-1 text-sm text-slate-500">
              We&rsquo;ve received your details and will be in touch shortly.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">Get in touch</h1>
            <p className="mt-1 text-sm text-slate-500">
              Leave your details and our team will reach out.
            </p>
            <form onSubmit={handleSubmit} className="mt-5 space-y-3">
              <input className={inputCls} placeholder="Full name" value={form.name} onChange={(e) => update('name', e.target.value)} />
              <input className={inputCls} placeholder="Phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
              <input className={inputCls} type="email" placeholder="Email" value={form.email} onChange={(e) => update('email', e.target.value)} />
              <input className={inputCls} placeholder="Company (optional)" value={form.company} onChange={(e) => update('company', e.target.value)} />
              <textarea className={`${inputCls} min-h-[88px] resize-none`} placeholder="How can we help?" value={form.message} onChange={(e) => update('message', e.target.value)} />

              {/* Honeypot — hidden from humans, catches bots. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={form.website}
                onChange={(e) => update('website', e.target.value)}
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1 }}
              />

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Submit
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
