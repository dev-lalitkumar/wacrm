import { FormInput, ExternalLink } from "lucide-react";
import { MockupFrame } from "./mockup-frame";

export function FormMockup({ className }: { className?: string }) {
  return (
    <MockupFrame url="yourwebsite.com/contact-us" className={className}>
      <div className="flex h-[420px] flex-col text-left">
        {/* Website context bar */}
        <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.01] px-4 py-2">
          <ExternalLink className="size-3.5 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">Embedded Tundla CRM form on your website</span>
        </div>

        <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-white/[0.02] to-transparent p-6">
          {/* Embedded form */}
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#0c0c12] p-6 shadow-xl">
            <div className="text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary/20">
                <FormInput className="size-5 text-primary" />
              </div>
              <h3 className="mt-3 text-lg font-semibold text-foreground">Get in Touch</h3>
              <p className="mt-1 text-xs text-muted-foreground">Fill out the form and we&apos;ll get back to you within 24 hours.</p>
            </div>

            <div className="mt-5 space-y-3">
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Full Name *</label>
                <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground">Aarav Mehta</div>
              </div>
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Email *</label>
                <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground">aarav@northwind.com</div>
              </div>
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Phone</label>
                <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground">+91 98765 43210</div>
              </div>
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Company</label>
                <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground">Northwind Retail</div>
              </div>
              <div>
                <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">I&apos;m interested in</label>
                <div className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-foreground">Pro Plan for 12 seats</div>
              </div>
              <button className="w-full rounded-lg bg-primary py-2.5 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20">
                Submit
              </button>
              <p className="text-center text-[9px] text-muted-foreground">
                Powered by Tundla CRM
              </p>
            </div>
          </div>
        </div>
      </div>
    </MockupFrame>
  );
}
