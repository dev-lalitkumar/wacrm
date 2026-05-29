import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckCircle2, Clock, Loader2 } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Deletion Request Status',
  robots: { index: false, follow: false },
}

interface StatusResponse {
  confirmation_code?: string
  status?: 'pending' | 'in_progress' | 'completed'
  submitted_at?: string
  processed_at?: string | null
  error?: string
}

async function fetchStatus(code: string): Promise<StatusResponse | null> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000')

  try {
    const res = await fetch(`${siteUrl}/api/meta/data-deletion?code=${code}`, {
      cache: 'no-store',
    })
    return (await res.json()) as StatusResponse
  } catch {
    return null
  }
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: 'text-amber-400',
    bg: 'border-amber-500/30 bg-amber-500/5',
    label: 'Pending Review',
    description: 'Your deletion request has been received and is awaiting review by our team.',
  },
  in_progress: {
    icon: Loader2,
    color: 'text-blue-400',
    bg: 'border-blue-500/30 bg-blue-500/5',
    label: 'In Progress',
    description: 'We are currently processing your deletion request.',
  },
  completed: {
    icon: CheckCircle2,
    color: 'text-green-400',
    bg: 'border-green-500/30 bg-green-500/5',
    label: 'Completed',
    description: 'Your data has been successfully deleted from our systems.',
  },
}

export default async function DeletionStatusPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>
}) {
  const { code } = await searchParams

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-lg px-6 py-16">
        <div className="mb-10">
          <Link
            href="/data-deletion"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Back to Data Deletion
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-white">Deletion Request Status</h1>
        </div>

        {!code ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center text-slate-400">
            <p>No confirmation code provided.</p>
            <Link href="/data-deletion" className="mt-3 inline-block text-primary hover:underline">
              Submit a deletion request
            </Link>
          </div>
        ) : (
          <StatusCard code={code} />
        )}

        <div className="mt-10 text-xs text-slate-500">
          <Link href="/privacy" className="hover:text-slate-300 transition-colors">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  )
}

async function StatusCard({ code }: { code: string }) {
  const data = await fetchStatus(code)

  if (!data || data.error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6">
        <p className="font-medium text-red-400">Request Not Found</p>
        <p className="mt-2 text-sm text-slate-400">
          No deletion request was found with confirmation code{' '}
          <code className="rounded bg-slate-800 px-1 text-slate-200">{code}</code>.
          Please check the code and try again, or contact us directly.
        </p>
      </div>
    )
  }

  const status = data.status ?? 'pending'
  const config = STATUS_CONFIG[status]
  const Icon = config.icon

  return (
    <div className={`rounded-lg border p-6 ${config.bg}`}>
      <div className="flex items-center gap-3">
        <Icon className={`size-5 ${config.color}`} />
        <h2 className={`font-semibold ${config.color}`}>{config.label}</h2>
      </div>
      <p className="mt-3 text-sm text-slate-300">{config.description}</p>

      <div className="mt-4 space-y-2 rounded-md border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-400">
        <div className="flex justify-between">
          <span>Confirmation code</span>
          <code className="text-slate-200">{data.confirmation_code}</code>
        </div>
        {data.submitted_at && (
          <div className="flex justify-between">
            <span>Submitted</span>
            <span className="text-slate-200">
              {new Date(data.submitted_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
        {data.processed_at && (
          <div className="flex justify-between">
            <span>Processed</span>
            <span className="text-green-300">
              {new Date(data.processed_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        )}
      </div>

      {status !== 'completed' && (
        <p className="mt-4 text-xs text-slate-500">
          Processing typically takes up to 30 days. You do not need to take any further action.
        </p>
      )}
    </div>
  )
}
