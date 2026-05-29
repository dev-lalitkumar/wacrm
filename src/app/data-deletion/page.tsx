import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Data Deletion Request',
  robots: { index: true, follow: false },
}

export default async function DataDeletionPage() {
  const companyName = 'Support Team'
  const contactEmail = 'support.crm@tundla.com'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-2xl px-6 py-16">
        <div className="mb-10">
          <Link
            href="/"
            className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            ← Back
          </Link>
          <h1 className="mt-4 text-3xl font-bold text-white">Data Deletion Request</h1>
          <p className="mt-2 text-sm text-slate-400">
            Request deletion of your personal data from {companyName}
          </p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-slate-300">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-3 font-semibold text-white">What data we hold</h2>
            <p className="text-slate-400">
              If you have used Facebook Login to connect to our CRM application, or if your
              information was submitted through a Facebook Lead Ad, we may hold:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-400">
              <li>Your Facebook user ID and display name</li>
              <li>Contact information submitted via lead forms (name, email, phone number)</li>
              <li>Facebook Page access tokens associated with your account</li>
            </ul>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-3 font-semibold text-white">How to request deletion</h2>

            <div className="space-y-4">
              <div className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  1
                </span>
                <div>
                  <p className="font-medium text-slate-200">Via Facebook Settings (Recommended)</p>
                  <p className="mt-1 text-slate-400">
                    Go to your{' '}
                    <a
                      href="https://www.facebook.com/settings?tab=applications"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Facebook Apps &amp; Websites settings
                    </a>
                    , find our app, and click &quot;Remove&quot;. This will automatically
                    trigger a deletion request to us.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  2
                </span>
                <div>
                  <p className="font-medium text-slate-200">Via Email</p>
                  <p className="mt-1 text-slate-400">
                    Send a deletion request to{' '}
                    <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                      {contactEmail}
                    </a>{' '}
                    with the subject line &quot;Data Deletion Request&quot; and include your
                    Facebook user ID or the email address associated with your lead submission.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-3 font-semibold text-white">Check deletion status</h2>
            <p className="text-slate-400">
              If you submitted a request via Facebook and received a confirmation code, you can
              check its status below:
            </p>
            <DataDeletionStatusForm siteUrl={siteUrl} />
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h2 className="mb-3 font-semibold text-white">Processing time</h2>
            <p className="text-slate-400">
              We process all deletion requests within <strong className="text-slate-200">30 days</strong> of
              receipt. Once completed, your data will be permanently removed from our systems.
              You will receive a confirmation at the email address you provided (if applicable).
            </p>
          </div>

          <p className="text-xs text-slate-500">
            This page satisfies the Meta Platform&apos;s Data Deletion Callback requirement.
            Automated deletion callbacks from Meta are received at{' '}
            <code className="rounded bg-slate-800 px-1 text-slate-400">
              {siteUrl}/api/meta/data-deletion
            </code>
            .
          </p>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-slate-300 transition-colors">
              Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function DataDeletionStatusForm({ siteUrl }: { siteUrl: string }) {
  return (
    <form
      action={`${siteUrl}/data-deletion/status`}
      method="get"
      className="mt-3 flex gap-2"
    >
      <input
        type="text"
        name="code"
        placeholder="Enter confirmation code"
        className="flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-primary focus:outline-none"
      />
      <button
        type="submit"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Check Status
      </button>
    </form>
  )
}
