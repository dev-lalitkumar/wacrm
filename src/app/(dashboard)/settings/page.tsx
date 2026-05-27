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
import { SourcesManager } from '@/components/settings/sources-manager';
import { IntegrationsManager } from '@/components/settings/integrations-manager';
import { useAuth } from '@/hooks/use-auth';
import {
  canManageTeam,
  canManageCustomFields,
  canViewWebhooks,
} from '@/lib/auth/permissions';

const TAB_VALUES = [
  'profile',
  'team',
  'custom-fields',
  'sources',
  'integrations',
  'whatsapp',
  'templates',
  'tags',
  'appearance',
] as const;
type TabValue = (typeof TAB_VALUES)[number];

function isTabValue(v: string | null): v is TabValue {
  return !!v && (TAB_VALUES as readonly string[]).includes(v);
}

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const showTeam = canManageTeam(profile?.role ?? null);
  const showCustomFields = canManageCustomFields(profile?.role ?? null);
  // Sources tab is visible to everyone (read-only for non-admins).
  // Integrations tab is admin/owner/manager only.
  const showIntegrations = canViewWebhooks(profile?.role ?? null);

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

  const onChange = (next: TabValue) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', next);
    router.replace(`/settings?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-slate-400 mt-1">
          Manage your profile, WhatsApp® integration, message templates, and
          tags.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => onChange(v as TabValue)}>
        <TabsList className="bg-slate-900 border border-slate-700">
          <TabsTrigger
            value="profile"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <User className="size-4" />
            Profile
          </TabsTrigger>
          {showTeam && (
            <TabsTrigger
              value="team"
              className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
            >
              <Users className="size-4" />
              Team
            </TabsTrigger>
          )}
          {showCustomFields && (
            <TabsTrigger
              value="custom-fields"
              className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
            >
              <LayoutList className="size-4" />
              Custom Fields
            </TabsTrigger>
          )}
          <TabsTrigger
            value="sources"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Tag className="size-4" />
            Sources
          </TabsTrigger>
          {showIntegrations && (
            <TabsTrigger
              value="integrations"
              className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
            >
              <WebhookIcon className="size-4" />
              Integrations
            </TabsTrigger>
          )}
          <TabsTrigger
            value="whatsapp"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Settings className="size-4" />
            WhatsApp Config
          </TabsTrigger>
          <TabsTrigger
            value="templates"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <MessageSquare className="size-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger
            value="tags"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Tag className="size-4" />
            Tags
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="data-active:bg-slate-800 data-active:text-primary text-slate-400"
          >
            <Palette className="size-4" />
            Appearance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileForm />
          <PasswordForm />
          <SessionsCard />
        </TabsContent>

        {showTeam && (
          <TabsContent value="team">
            <TeamManager />
          </TabsContent>
        )}

        {showCustomFields && (
          <TabsContent value="custom-fields" className="space-y-6">
            <CustomFieldsManager />
          </TabsContent>
        )}

        <TabsContent value="sources" className="space-y-6">
          <SourcesManager />
        </TabsContent>

        {showIntegrations && (
          <TabsContent value="integrations" className="space-y-6">
            <IntegrationsManager />
          </TabsContent>
        )}

        <TabsContent value="whatsapp">
          <WhatsAppConfig />
        </TabsContent>

        <TabsContent value="templates">
          <TemplateManager />
        </TabsContent>

        <TabsContent value="tags">
          <TagManager />
        </TabsContent>

        <TabsContent value="appearance">
          <AppearancePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
