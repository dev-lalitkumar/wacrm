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

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  owner: 'Owner',
  manager: 'Manager',
  executive: 'Executive',
}
