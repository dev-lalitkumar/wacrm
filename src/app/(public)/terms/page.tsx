import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  robots: { index: true, follow: false },
}

export default async function TermsPage() {
  const companyName = 'Tundla CRM'
  const contactEmail = 'support.crm@tundla.com'
  const lastUpdated = 'June 2026'

  return (
    <div className="text-slate-200">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white">Terms &amp; Conditions</h1>
          <p className="mt-2 text-sm text-slate-400">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">1. Acceptance of Terms</h2>
            <p>
              By accessing or using the CRM Service operated by {companyName} (&quot;we&quot;,
              &quot;our&quot;, or &quot;us&quot;), you agree to be bound by these Terms &amp;
              Conditions. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">2. Description of Service</h2>
            <p>
              The Service is a Customer Relationship Management (CRM) tool that enables
              businesses to manage contacts, sales pipelines, WhatsApp Business communications,
              and lead capture from Meta platforms including Facebook Lead Ads.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">3. Use of Facebook and Meta Features</h2>
            <p>
              The Service integrates with Meta platforms. By using these features, you agree to:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Comply with{' '}
                <a
                  href="https://www.facebook.com/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Facebook&apos;s Terms of Service
                </a>
              </li>
              <li>
                Comply with{' '}
                <a
                  href="https://developers.facebook.com/policy/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Meta Platform Terms
                </a>
              </li>
              <li>
                Comply with{' '}
                <a
                  href="https://www.whatsapp.com/legal/business-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  WhatsApp Business Policy
                </a>
              </li>
              <li>Only use lead data for the purposes disclosed in your Facebook Lead Ads forms</li>
              <li>Not use lead data for unsolicited bulk messaging or spam</li>
              <li>Honour data deletion requests from Facebook users promptly</li>
              <li>Only connect Facebook Pages and WhatsApp accounts that you are authorised to manage</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">4. WhatsApp Business Usage</h2>
            <p>
              The Service uses the WhatsApp Business Cloud API. You must comply with
              WhatsApp&apos;s Business Policy and Messaging Policy. Prohibited uses include:
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Sending unsolicited messages (spam)</li>
              <li>Sending messages outside of the allowed messaging windows without approved templates</li>
              <li>Impersonating other businesses or individuals</li>
              <li>Sending prohibited content (illegal goods, hate speech, etc.)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">5. User Responsibilities</h2>
            <p>You are responsible for:</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities that occur under your account</li>
              <li>Ensuring your use of the Service complies with applicable laws</li>
              <li>Obtaining any necessary consents from your contacts before messaging them</li>
              <li>Informing your leads how their data will be used in your lead ad forms</li>
              <li>Keeping your Facebook and WhatsApp credentials secure</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">6. Data and Privacy</h2>
            <p>
              Your use of the Service is subject to our{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference. You acknowledge that we
              process data on your behalf as described in that policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">7. Intellectual Property</h2>
            <p>
              The Service and its original content, features, and functionality are owned by
              {' '}{companyName} and are protected by applicable intellectual property laws. You
              may not copy, modify, or distribute any part of the Service without our prior
              written consent.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">8. Disclaimer of Warranties</h2>
            <p>
              The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis
              without warranties of any kind, either express or implied, including but not limited
              to implied warranties of merchantability, fitness for a particular purpose, or
              non-infringement.
            </p>
            <p className="mt-3">
              We do not warrant that the Service will be uninterrupted, error-free, or that
              defects will be corrected. We are not responsible for any disruptions to Meta
              platform services that affect the operation of integrations.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">9. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, {companyName} shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages arising from your
              use of or inability to use the Service, including but not limited to loss of data,
              loss of profits, or loss of business opportunities.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at our
              sole discretion, without prior notice, for conduct that we believe violates these
              Terms or is harmful to other users, us, third parties, or for any other reason.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes take effect
              immediately upon posting. Your continued use of the Service after any modification
              constitutes acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">12. Governing Law</h2>
            <p>
              These Terms shall be governed by and construed in accordance with applicable law.
              Any disputes arising under these Terms shall be resolved through good-faith
              negotiation. If unresolved, disputes shall be submitted to binding arbitration.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-white">13. Contact</h2>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <p className="font-semibold text-white">{companyName}</p>
              <p className="mt-1">
                <a href={`mailto:${contactEmail}`} className="text-primary hover:underline">
                  {contactEmail}
                </a>
              </p>
            </div>
          </section>
        </div>

        <div className="mt-12 border-t border-slate-800 pt-6 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-slate-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/data-deletion" className="hover:text-slate-300 transition-colors">
              Data Deletion
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
