'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import {
  Settings,
  MessageSquare,
  Tag,
  User,
  Palette,
  Users,
  LayoutList,
  Webhook as WebhookIcon,
  XCircle,
  Building2,
  Mail,
  Share2,
  Phone,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WhatsAppConfig } from '@/components/settings/whatsapp-config';
import { TemplateManager } from '@/components/settings/template-manager';
import { TagManager } from '@/components/settings/tag-manager';
import { ProfileForm } from '@/components/settings/profile-form';
import { PasswordForm } from '@/components/settings/password-form';
import { SessionsCard } from '@/components/settings/sessions-card';
import { AppearancePanel } from '@/components/settings/appearance-panel';
import { TeamManager } from '@/components/settings/team-manager';
import { CustomFieldsManager } from '@/components/settings/custom-fields-manager';
import { LostReasonsManager } from '@/components/settings/lost-reasons-manager';
import { SourcesManager } from '@/components/settings/sources-manager';
import { IntegrationsManager } from '@/components/settings/integrations-manager';
import { CompanyForm } from '@/components/settings/company-form';
import { GmailConfig } from '@/components/settings/gmail-config';
import { MetaConfig } from '@/components/settings/meta-config';
import { CallCenterConfig } from '@/components/settings/call-center-config';
import { useAuth } from '@/hooks/use-auth';
import {
  canManageTeam,
  canManageCustomFields,
  canViewWebhooks,
  canManageCompany,
  canManageEmailConfig,
  canManageMetaConfig,
  canManageCallCenter,
} from '@/lib/auth/permissions';

const TAB_VALUES = [
  'profile',
  'company',
  'team',
  'custom-fields',
  'lost-reasons',
  'sources',
  'integrations',
  'whatsapp',
  'email',
  'meta',
  'call-center',
  'templates',
  'tags',
  'appearance',
] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

/* Section heading inside the vertical nav */
function NavSection({ children }: { children: React.ReactNode }) {
  return (
    <span className="hidden md:block px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 select-none first:pt-0">
      {children}
    </span>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, profileLoading } = useAuth();
  // While profile is still loading we treat everything as visible so
  // tabs don't flash in after a short delay. Once the profile resolves
  // the correct gates apply. This matches the pattern used by WhatsApp
  // (always visible) and avoids a jarring layout shift for admins.
  const role = profile?.role ?? null;
  const showTeam = profileLoading || canManageTeam(role);
  const showCustomFields = profileLoading || canManageCustomFields(role);
  const showCompany = profileLoading || canManageCompany(role);
  // Sources tab is visible to everyone (read-only for non-admins).
  // Integrations tab is admin/owner/manager only.
  const showIntegrations = profileLoading || canViewWebhooks(role);
  const showEmail = profileLoading || canManageEmailConfig(role);
  const showMeta = profileLoading || canManageMetaConfig(role);
  const showCallCenter = profileLoading || canManageCallCenter(role);

  // The URL is the single source of truth for the active tab — no
  // local state, no sync effect. A previous revision duplicated this
  // into `useState` + a sync effect, which tripped React 19's
  // set-state-in-effect rule and was also redundant.
  const queryTab = searchParams.get('tab');
  let tab: TabValue = isTabValue(queryTab) ? queryTab : 'profile';
  // Route-guard the Team tab — a non-Admin/Owner who pastes
  // ?tab=team into the URL should still land on Profile.
  if (tab === 'team' && !showTeam) {
    tab = 'profile';
  }
  if (tab === 'custom-fields' && !showCustomFields) {
    tab = 'profile';
  }
  if (tab === 'integrations' && !showIntegrations) {
    tab = 'profile';
  }
  if (tab === 'company' && !showCompany) {
    tab = 'profile';
  }
  if (tab === 'email' && !showEmail) {
    tab = 'profile';
  }
  if (tab === 'meta' && !showMeta) {
    tab = 'profile';
  }
  if (tab === 'call-center' && !showCallCenter) {
    tab = 'profile';
  }

  const onChange = (next: TabValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  const triggerCls =
    'justify-start gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-slate-200 data-active:bg-slate-800 data-active:text-primary';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your profile, integrations, message templates, and more.
        </p>
      </div>

      {/* ── Vertical sidebar on md+, horizontal scroll on mobile ── */}
      <Tabs
        value={tab}
        onValueChange={(v) => onChange(v as TabValue)}
        orientation="vertical"
        className="!flex-row"
      >
        {/* ── Left nav ─────────────────────────────────────────── */}
        <TabsList className="shrink-0 gap-0.5 overflow-x-auto border-slate-800 bg-transparent md:w-48 md:flex-col md:items-stretch md:overflow-visible md:border-r md:pr-4">
          <NavSection>Account</NavSection>
          <TabsTrigger value="profile" className={triggerCls}>
            <User className="size-4 shrink-0" />
            Profile
          </TabsTrigger>
          {showCompany && (
            <TabsTrigger value="company" className={triggerCls}>
              <Building2 className="size-4 shrink-0" />
              Company
            </TabsTrigger>
          )}
          {showTeam && (
            <TabsTrigger value="team" className={triggerCls}>
              <Users className="size-4 shrink-0" />
              Team
            </TabsTrigger>
          )}
          <TabsTrigger value="appearance" className={triggerCls}>
            <Palette className="size-4 shrink-0" />
            Appearance
          </TabsTrigger>

          <NavSection>CRM</NavSection>
          {showCustomFields && (
            <TabsTrigger value="custom-fields" className={triggerCls}>
              <LayoutList className="size-4 shrink-0" />
              Custom Fields
            </TabsTrigger>
          )}
          <TabsTrigger value="lost-reasons" className={triggerCls}>
            <XCircle className="size-4 shrink-0" />
            Lost Reasons
          </TabsTrigger>
          <TabsTrigger value="sources" className={triggerCls}>
            <Tag className="size-4 shrink-0" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="tags" className={triggerCls}>
            <Tag className="size-4 shrink-0" />
            Tags
          </TabsTrigger>
          <TabsTrigger value="templates" className={triggerCls}>
            <MessageSquare className="size-4 shrink-0" />
            Templates
          </TabsTrigger>

          <NavSection>Channels</NavSection>
          <TabsTrigger value="whatsapp" className={triggerCls}>
            <Settings className="size-4 shrink-0" />
            WhatsApp
          </TabsTrigger>
          {showEmail && (
            <TabsTrigger value="email" className={triggerCls}>
              <Mail className="size-4 shrink-0" />
              Email
            </TabsTrigger>
          )}
          {showMeta && (
            <TabsTrigger value="meta" className={triggerCls}>
              <Share2 className="size-4 shrink-0" />
              Meta / Facebook
            </TabsTrigger>
          )}
          {showCallCenter && (
            <TabsTrigger value="call-center" className={triggerCls}>
              <Phone className="size-4 shrink-0" />
              Call Center
            </TabsTrigger>
          )}
          {showIntegrations && (
            <TabsTrigger value="integrations" className={triggerCls}>
              <WebhookIcon className="size-4 shrink-0" />
              Integrations
            </TabsTrigger>
          )}
        </TabsList>

        {/* ── Content area ─────────────────────────────────────── */}
        <div className="min-w-0 flex-1">
          <TabsContent value="profile" className="space-y-6">
            <ProfileForm />
            <PasswordForm />
            <SessionsCard />
          </TabsContent>

          {showCompany && (
            <TabsContent value="company" className="space-y-6">
              <CompanyForm />
            </TabsContent>
          )}

          {showTeam && (
            <TabsContent value="team">
              <TeamManager />
            </TabsContent>
          )}

          <TabsContent value="appearance">
            <AppearancePanel />
          </TabsContent>

          {showCustomFields && (
            <TabsContent value="custom-fields" className="space-y-6">
              <CustomFieldsManager />
            </TabsContent>
          )}

          <TabsContent value="lost-reasons" className="space-y-6">
            <LostReasonsManager />
          </TabsContent>

          <TabsContent value="sources" className="space-y-6">
            <SourcesManager />
          </TabsContent>

          <TabsContent value="tags">
            <TagManager />
          </TabsContent>

          <TabsContent value="templates">
            <TemplateManager />
          </TabsContent>

          <TabsContent value="whatsapp">
            <WhatsAppConfig />
          </TabsContent>

          {showEmail && (
            <TabsContent value="email" className="space-y-6">
              <GmailConfig />
            </TabsContent>
          )}

          {showMeta && (
            <TabsContent value="meta" className="space-y-6">
              <MetaConfig />
            </TabsContent>
          )}

          {showCallCenter && (
            <TabsContent value="call-center" className="space-y-6">
              <CallCenterConfig />
            </TabsContent>
          )}

          {showIntegrations && (
            <TabsContent value="integrations" className="space-y-6">
              <IntegrationsManager />
            </TabsContent>
          )}
        </div>
      </Tabs>
    </div>
  );
}
