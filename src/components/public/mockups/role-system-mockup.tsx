import { Shield, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Permission = {
  label: string;
  admin: boolean;
  manager: boolean;
  executive: boolean;
};

const PERMISSIONS: Permission[] = [
  { label: "View all contacts & deals", admin: true, manager: true, executive: false },
  { label: "View assigned contacts only", admin: false, manager: false, executive: true },
  { label: "Create & send broadcasts", admin: true, manager: true, executive: false },
  { label: "Manage message templates", admin: true, manager: true, executive: false },
  { label: "Create automations & flows", admin: true, manager: false, executive: false },
  { label: "Manage team members", admin: true, manager: false, executive: false },
  { label: "Configure integrations", admin: true, manager: false, executive: false },
  { label: "Pipeline & stage setup", admin: true, manager: false, executive: false },
  { label: "View reports (scoped)", admin: true, manager: true, executive: true },
  { label: "Custom fields management", admin: true, manager: false, executive: false },
  { label: "Notification templates", admin: true, manager: false, executive: false },
  { label: "Audit log access", admin: true, manager: false, executive: false },
];

function PermIcon({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <Check className="size-3.5 text-green-400" />
  ) : (
    <X className="size-3.5 text-white/10" />
  );
}

export function RoleSystemMockup({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-white/10 bg-[#0c0c12] p-5", className)}>
      <div className="flex items-center gap-2 pb-4">
        <Shield className="size-5 text-primary" />
        <span className="text-sm font-semibold text-foreground">Role-Based Access Control</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/5">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/5 bg-white/[0.02]">
              <th className="px-3 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Permission</th>
              <th className="w-20 px-3 py-2.5 text-center">
                <div className="text-[10px] font-semibold text-primary">Admin</div>
              </th>
              <th className="w-20 px-3 py-2.5 text-center">
                <div className="text-[10px] font-semibold text-amber-400">Manager</div>
              </th>
              <th className="w-20 px-3 py-2.5 text-center">
                <div className="text-[10px] font-semibold text-cyan-400">Executive</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p.label} className="border-b border-white/5 last:border-0">
                <td className="px-3 py-2 text-[11px] text-foreground/80">{p.label}</td>
                <td className="px-3 py-2 text-center"><PermIcon allowed={p.admin} /></td>
                <td className="px-3 py-2 text-center"><PermIcon allowed={p.manager} /></td>
                <td className="px-3 py-2 text-center"><PermIcon allowed={p.executive} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {[
          { role: "Admin", desc: "Full control over workspace, team, and settings", color: "border-primary/30 bg-primary/5" },
          { role: "Manager", desc: "Team access to broadcasts, templates, and tags", color: "border-amber-500/30 bg-amber-500/5" },
          { role: "Executive", desc: "Access to own assigned contacts and deals", color: "border-cyan-500/30 bg-cyan-500/5" },
        ].map((r) => (
          <div key={r.role} className={cn("rounded-lg border p-3 text-center", r.color)}>
            <p className="text-xs font-semibold text-foreground">{r.role}</p>
            <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{r.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
