'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useCompany } from '@/hooks/use-company';
import { useTotalUnread } from '@/hooks/use-total-unread';
import { canViewSidebarItem, ROLE_LABEL } from '@/lib/auth/permissions';
import {
  LayoutDashboard,
  MessageSquare,
  MessageSquareMore,
  Users,
  Briefcase,
  Archive,
  BarChart2,
  Radio,
  Zap,
  Workflow,
  Settings,
  LogOut,
  User,
  X,
  FileText,
  Package,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /**
   * When true, the nav row renders a small "Beta" chip after the label.
   * Purely informational — doesn't affect routing or access.
   */
  beta?: boolean;
  /**
   * Optional permission slot — when set, the row is only visible to
   * roles for which `canViewSidebarItem(slot, role)` is true. Items
   * without a slot are visible to every signed-in user.
   */
  permission?: 'broadcasts' | 'automations' | 'flows';
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pipelines', label: 'Deals', icon: Briefcase },
  { href: '/closed-deals', label: 'Closed Deals', icon: Archive },
  { href: '/contacts', label: 'Contacts', icon: Users },
  { href: '/proposals', label: 'Proposals', icon: FileText },
  { href: '/catalog', label: 'Catalog', icon: Package },
];

const whatsappNavItems: NavItem[] = [
  { href: '/wa-dashboard', label: 'WA Dashboard', icon: MessageSquareMore },
  { href: '/inbox', label: 'Inbox', icon: MessageSquare },
  {
    href: '/broadcasts',
    label: 'Broadcasts',
    icon: Radio,
    permission: 'broadcasts',
  },
  {
    href: '/automations',
    label: 'Automations',
    icon: Zap,
    permission: 'automations',
  },
  {
    href: '/flows',
    label: 'Flows',
    icon: Workflow,
    beta: true,
    permission: 'flows',
  },
];

const bottomNavItems: NavItem[] = [
  { href: '/reports', label: 'Reports', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

/** Reusable nav-row renderer for all three nav sections. */
function NavRow({
  item,
  pathname,
  role,
  totalUnread,
}: {
  item: NavItem;
  pathname: string;
  role: string | null;
  totalUnread: number;
}) {
  // Hide role-restricted entries before any rendering work.
  if (
    item.permission &&
    !canViewSidebarItem(item.permission, role)
  ) {
    return null;
  }

  const isActive =
    pathname === item.href ||
    (item.href !== '/dashboard' && pathname.startsWith(item.href));

  const showUnreadDot =
    item.href === '/inbox' && totalUnread > 0 && !isActive;

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          // Taller on mobile so fingers can hit the row reliably (≥44px).
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        )}
      >
        <item.icon className="h-4 w-4" />
        <span className="flex-1">{item.label}</span>
        {item.beta && (
          <span
            aria-label="Beta feature"
            className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-amber-300 uppercase"
          >
            Beta
          </span>
        )}
        {showUnreadDot && (
          <span
            aria-label={`${totalUnread} unread conversation${totalUnread === 1 ? '' : 's'}`}
            className="relative flex h-2 w-2"
          >
            <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
            <span className="bg-primary relative inline-flex h-2 w-2 rounded-full" />
          </span>
        )}
      </Link>
    </li>
  );
}

interface SidebarProps {
  /** Controlled on mobile by the Header's hamburger button. Ignored on lg+. */
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const { company } = useCompany();
  const totalUnread = useTotalUnread();

  // Close the drawer when route changes — users opened it to navigate,
  // so once they pick a destination the drawer should get out of the way.
  useEffect(() => {
    onClose?.();
    // Only pathname drives this — onClose identity doesn't need to re-run it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock body scroll and allow Escape to close while the drawer is open on
  // mobile. No-ops on desktop because the sidebar isn't positioned there.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <>
      {/* Backdrop — only exists on mobile and only when open. Clicking
          it closes the drawer. Hidden from lg+ since the sidebar is
          part of the main flex row there. */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          'fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity lg:hidden',
          open
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0'
        )}
      />

      <aside
        className={cn(
          // Mobile: fixed drawer that slides in from the left.
          'fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-slate-800 bg-slate-900',
          'transition-transform duration-200 ease-out will-change-transform',
          open ? 'translate-x-0' : '-translate-x-full',
          // Desktop: static, always visible — reset all the mobile framing.
          'lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none'
        )}
        aria-label="Primary"
      >
        {/* Logo row. On mobile we put a close button here; on desktop the
            close button is hidden since the sidebar is always-visible. */}
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-800 px-4">
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            {company?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={company.logo_url}
                alt={company.name}
                className="h-8 w-8 shrink-0 rounded-lg object-cover bg-slate-800"
              />
            ) : (
              <div className="bg-primary text-primary-foreground flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <MessageSquare className="h-4 w-4" />
              </div>
            )}
            <span className="truncate text-sm font-semibold text-white">
              {company?.name || 'Wulk CRM'}
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {/* ── CRM section ── */}
          <ul className="flex flex-col gap-1">
            {mainNavItems.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                pathname={pathname}
                role={profile?.role ?? null}
                totalUnread={totalUnread}
              />
            ))}
          </ul>

          {/* ── WhatsApp section ── */}
          <div className="my-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 select-none">
              WhatsApp
            </span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>
          <ul className="flex flex-col gap-1">
            {whatsappNavItems.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                pathname={pathname}
                role={profile?.role ?? null}
                totalUnread={totalUnread}
              />
            ))}
          </ul>

          <div className="my-4 border-t border-slate-800" />

          <ul className="flex flex-col gap-1">
            {bottomNavItems.map((item) => (
              <NavRow
                key={item.href}
                item={item}
                pathname={pathname}
                role={profile?.role ?? null}
                totalUnread={totalUnread}
              />
            ))}
          </ul>
        </nav>

        {/* User section */}
        <div className="shrink-0 border-t border-slate-800 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-800/60 focus:bg-slate-800/60 focus:outline-none data-popup-open:bg-slate-800/60">
              <Avatar className="size-8 shrink-0">
                {profile?.avatar_url ? (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? 'Avatar'}
                  />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                  {profile?.full_name?.charAt(0)?.toUpperCase() ??
                    profile?.email?.charAt(0)?.toUpperCase() ??
                    'U'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium text-white">
                    {profile?.full_name ?? 'User'}
                  </p>
                  {profile?.role && (
                    <span
                      className="shrink-0 rounded-full border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-slate-300 uppercase"
                      aria-label={`Role: ${ROLE_LABEL[profile.role]}`}
                    >
                      {ROLE_LABEL[profile.role]}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-slate-400">
                  {profile?.email ?? ''}
                </p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              sideOffset={6}
              className="min-w-56 bg-slate-900 text-slate-100 ring-slate-700"
            >
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=profile"
                    onClick={onClose}
                    className="text-slate-200 focus:bg-slate-800 focus:text-white"
                  />
                }
              >
                <User className="size-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    href="/settings?tab=whatsapp"
                    onClick={onClose}
                    className="text-slate-200 focus:bg-slate-800 focus:text-white"
                  />
                }
              >
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-800" />
              <DropdownMenuItem
                onClick={signOut}
                className="text-slate-200 focus:bg-slate-800 focus:text-white"
              >
                <LogOut className="size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}
