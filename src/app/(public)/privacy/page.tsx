import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  robots: { index: true, follow: false },
};

export default async function PrivacyPage() {
  const companyName = 'Tundla CRM';
  const contactEmail = 'support.crm@tundla.com';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://crm.tundla.com';
  const lastUpdated = 'June 2026';

  return (
    <div className="text-slate-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
          <p className="mt-2 text-sm text-slate-400">
            Last updated: {lastUpdated}
          </p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              1. Introduction
            </h2>
            <p>
              {companyName} (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;)
              operates a CRM application (&quot;the Service&quot;) accessible at{' '}
              <a href={siteUrl} className="text-primary hover:underline">
                {siteUrl}
              </a>
              . This Privacy Policy explains how we collect, use, disclose, and
              safeguard information when you use our Service, including
              information obtained through integrations with Meta platforms
              (Facebook, WhatsApp, Instagram).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              2. Information We Collect
            </h2>
            <h3 className="mb-2 font-medium text-slate-200">
              2.1 Information You Provide
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>Account registration details (name, email, password)</li>
              <li>Company and business information</li>
              <li>CRM data you enter (contacts, deals, notes)</li>
              <li>WhatsApp Business configuration credentials</li>
            </ul>
            <h3 className="mt-4 mb-2 font-medium text-slate-200">
              2.2 Information from Meta Platforms
            </h3>
            <p>
              When you connect your Facebook account or WhatsApp Business
              account, we receive:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Facebook Page names, IDs, and access tokens</li>
              <li>
                Lead data submitted through Facebook Lead Ads forms (name,
                email, phone number, and other fields you configure)
              </li>
              <li>WhatsApp Business Account ID and phone number details</li>
              <li>
                Your Facebook user ID and display name (for authentication only)
              </li>
            </ul>
            <h3 className="mt-4 mb-2 font-medium text-slate-200">
              2.3 Automatically Collected Information
            </h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>IP addresses (logged for webhook security)</li>
              <li>API request logs (for debugging and rate limiting)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              3. How We Use Your Information
            </h2>
            <p>We use collected information to:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Provide and operate the CRM Service</li>
              <li>
                Receive and store leads from Facebook Lead Ads into your CRM
              </li>
              <li>Enable WhatsApp Business messaging through the Cloud API</li>
              <li>
                Send and receive messages on your behalf via WhatsApp Business
              </li>
              <li>Process and fulfill data deletion requests</li>
              <li>Maintain security, prevent fraud, and debug issues</li>
            </ul>
            <p className="mt-3">
              We do <strong className="text-white">not</strong> sell your data
              or the data of your contacts to third parties. We do not use
              Facebook lead data for advertising purposes or share it with Meta
              for retargeting.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              4. Facebook Data and Meta Platform Policy
            </h2>
            <p>
              Our use of information received from Meta APIs is governed by the{' '}
              <a
                href="https://developers.facebook.com/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Meta Platform Terms
              </a>{' '}
              and the{' '}
              <a
                href="https://www.facebook.com/privacy/policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Meta Privacy Policy
              </a>
              . Specifically:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Lead data from Facebook Lead Ads is only accessed by the
                business that owns the CRM account
              </li>
              <li>
                Facebook Page access tokens are encrypted at rest using
                AES-256-GCM
              </li>
              <li>
                We request only the minimum permissions required to operate the
                lead capture features
              </li>
              <li>
                We comply with Meta&apos;s data deletion requirements — see
                Section 7 below
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              5. Data Storage and Security
            </h2>
            <p>
              Your data is stored in a PostgreSQL database hosted on Supabase.
              All API tokens and credentials are encrypted at rest using
              AES-256-GCM encryption. We use row-level security (RLS) to enforce
              data access controls.
            </p>
            <p className="mt-3">
              Despite our security measures, no method of electronic
              transmission or storage is 100% secure. We cannot guarantee
              absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              6. Data Retention
            </h2>
            <p>
              We retain your data for as long as your account is active or as
              needed to provide the Service. Contact data (leads) are retained
              until you explicitly delete them from the CRM. You may request
              deletion of your data at any time (see Section 7).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              7. Data Deletion Requests
            </h2>
            <p>
              If you have used our application via Facebook Login and wish to
              request deletion of your data, you may do so by:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Submitting a request through our{' '}
                <Link
                  href="/data-deletion"
                  className="text-primary hover:underline"
                >
                  Data Deletion Request page
                </Link>
              </li>
              <li>
                Removing our app from your Facebook settings at{' '}
                <a
                  href="https://www.facebook.com/settings?tab=applications"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  facebook.com/settings → Apps and Websites
                </a>{' '}
                (this triggers an automatic deletion callback to us)
              </li>
            </ul>
            <p className="mt-3">
              We will process deletion requests within 30 days and send
              confirmation to your registered email address. You can check the
              status of your request using the confirmation code provided.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              8. Third-Party Services
            </h2>
            <p>
              Our Service integrates with the following third-party platforms:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong className="text-slate-200">Meta / Facebook</strong> —
                Lead Ads, Facebook Login, WhatsApp Business Cloud API
              </li>
              <li>
                <strong className="text-slate-200">Supabase</strong> — Database
                and authentication hosting
              </li>
              <li>
                <strong className="text-slate-200">Google</strong> — Optional
                Gmail integration for email sending
              </li>
            </ul>
            <p className="mt-3">
              Each service has its own privacy policy. We are not responsible
              for the privacy practices of these third-party services.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              9. Children&apos;s Privacy
            </h2>
            <p>
              Our Service is not directed to individuals under 13 years of age.
              We do not knowingly collect personal information from children
              under 13.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              10. Changes to This Policy
            </h2>
            <p>
              We may update this Privacy Policy from time to time. We will
              notify you of any changes by updating the &quot;Last updated&quot;
              date at the top of this page. Continued use of the Service after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">
              11. Contact Us
            </h2>
            <p>
              If you have any questions about this Privacy Policy or our data
              practices, please contact us at:
            </p>
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="font-semibold text-white">{companyName}</p>
              <p className="mt-1">
                <a
                  href={`mailto:${contactEmail}`}
                  className="text-primary hover:underline"
                >
                  {contactEmail}
                </a>
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <Link
              href="/terms"
              className="transition-colors hover:text-slate-300"
            >
              Terms &amp; Conditions
            </Link>
            <Link
              href="/data-deletion"
              className="transition-colors hover:text-slate-300"
            >
              Data Deletion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
