export type Role = 'admin' | 'owner' | 'manager' | 'executive'

// All helpers default to "no" when the role is missing (null /
// undefined / unknown string). The DB / RLS remains the source of
// truth; these are UI gates only.
const ROLES: Role[] = ['admin', 'owner', 'manager', 'executive']

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as string[]).includes(value)
}

export function canManageTeam(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

export function canCreateAdmins(role: Role | string | null | undefined) {
  return role === 'admin'
}

export function canManageWhatsAppConfig(
  role: Role | string | null | undefined,
) {
  return role === 'admin' || role === 'owner'
}

export function canManageAutomations(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

export function canManageFlows(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

export function canManagePipelinesSettings(
  role: Role | string | null | undefined,
) {
  return role === 'admin' || role === 'owner'
}

export function canManageTemplates(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canManageTags(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canManageBroadcasts(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canSeeAllContacts(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canSeeAllDeals(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canSeeAllConversations(
  role: Role | string | null | undefined,
) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canDeleteContacts(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canAssignContacts(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canViewSidebarItem(
  item: 'broadcasts' | 'automations' | 'flows' | 'pipelines',
  role: Role | string | null | undefined,
) {
  switch (item) {
    case 'broadcasts':
      return canManageBroadcasts(role)
    case 'automations':
    case 'flows':
      return canManageAutomations(role)
    case 'pipelines':
      // Pipelines are visible to everyone — executives still need
      // to see their assigned deals on the board.
      return role === 'admin' || role === 'owner' || role === 'manager' || role === 'executive'
    default:
      return false
  }
}

export function canManagePipelines(role: Role | string | null | undefined) {
  return role === 'admin'
}

export function canManageCustomFields(role: Role | string | null | undefined) {
  return role === 'admin'
}

// ── Integrations (migration 015) ───────────────────────────────
//
// Admin: full CRUD on webhooks + sources + global round-robin.
// Owner: view webhooks + reveal/copy secret; view sources read-only.
// Manager: view webhooks (no secret); view sources read-only.
// Executive: no access — Integrations tab is hidden.

export function canManageWebhooks(role: Role | string | null | undefined) {
  return role === 'admin'
}

export function canViewWebhooks(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canRevealWebhookSecret(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

export function canManageSources(role: Role | string | null | undefined) {
  return role === 'admin'
}

// ── Lost Reasons (migration 018) ───────────────────────────────
export function canManageLostReasons(role: Role | string | null | undefined) {
  return role === 'admin'
}

// ── Company (migration 019) ────────────────────────────────────
/** Admin + Owner can edit the org-wide company info (name, logo, etc) */
export function canManageCompany(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

// ── Gmail Integration (migration 020) ─────────────────────────
/** Admin + Owner can configure the org-wide Gmail integration */
export function canManageEmailConfig(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

// ── Meta / Facebook Integration (migration 024) ────────────────
/** Admin + Owner can configure Facebook Login, Lead Ads, and WhatsApp coexistence */
export function canManageMetaConfig(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

// ── Call Center / Telephony (migration 026) ────────────────────
/** Admin + Owner can configure telephony providers */
export function canManageCallCenter(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

// ── Assignee filter (deals + contacts) ─────────────────────────
/** Admin/Owner/Manager can filter by assignee. Executives are RLS-scoped to own data. */
export function canFilterAssignees(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

// ── Reports ───────────────────────────────────────────────────
/** Admin/Owner see all reps' data */
export function canViewAllReports(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner'
}

/** Admin/Owner/Manager see all executives + themselves */
export function canViewTeamReports(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

/** Admin/Owner/Manager set sales targets / quotas for reps */
export function canManageTargets(role: Role | string | null | undefined) {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  owner: 'Owner',
  manager: 'Manager',
  executive: 'Executive',
}
