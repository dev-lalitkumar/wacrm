'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Loader2,
  KeyRound,
  UserCog,
  UserX,
  UserCheck,
  RefreshCcw,
} from 'lucide-react';

import { useAuth } from '@/hooks/use-auth';
import {
  canCreateAdmins,
  canManageTeam,
  ROLE_LABEL,
  type Role,
} from '@/lib/auth/permissions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Mirrors the GET /api/users response shape — kept local since the
// only consumer is this component.
interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  role: Role;
  avatar_url: string | null;
  is_active: boolean;
  must_change_password: boolean;
  created_by: string | null;
  created_at: string;
}

function generateTempPassword(): string {
  // 16-char URL-safe random — comfortably above the 8-char floor
  // enforced server-side, and easy to copy/paste from the dialog.
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function ROLE_OPTIONS(callerRole: Role | null): Role[] {
  // Owners can't grant Admin. Everyone else sees the same set minus
  // any restriction the caller can't actually perform — the server
  // re-validates regardless.
  if (callerRole === 'admin') {
    return ['admin', 'owner', 'manager', 'executive'];
  }
  return ['owner', 'manager', 'executive'];
}

export function TeamManager() {
  const { profile, user, refreshProfile } = useAuth();
  const callerRole = (profile?.role ?? null) as Role | null;

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>('executive');
  const [newPassword, setNewPassword] = useState('');

  const [editTarget, setEditTarget] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<Role>('executive');
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [resetTarget, setResetTarget] = useState<TeamMember | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users');
      const payload = (await res.json().catch(() => ({}))) as {
        users?: TeamMember[];
        error?: string;
      };
      if (!res.ok) {
        toast.error(payload.error ?? 'Failed to load team');
        return;
      }
      setMembers(payload.users ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManageTeam(callerRole)) return;
    fetchMembers();
  }, [callerRole, fetchMembers]);

  const roleOptions = useMemo(() => ROLE_OPTIONS(callerRole), [callerRole]);

  if (!canManageTeam(callerRole)) {
    return (
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Team</CardTitle>
          <CardDescription className="text-slate-400">
            Only Admins and Owners can manage team members.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleCreate = async () => {
    if (!newFullName.trim() || !newEmail.trim() || !newPassword) {
      toast.error('Name, email, and temporary password are required');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          full_name: newFullName.trim(),
          email: newEmail.trim().toLowerCase(),
          role: newRole,
          temp_password: newPassword,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: TeamMember;
      };
      if (!res.ok) {
        toast.error(payload.error ?? 'Failed to create user');
        return;
      }
      toast.success(
        `${newFullName.trim()} created. Share the temporary password securely — they will be prompted to change it on first sign in.`,
      );
      setCreateOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewRole('executive');
      setNewPassword('');
      await fetchMembers();
    } finally {
      setCreating(false);
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const body: Record<string, unknown> = {};
      if (editName.trim() && editName.trim() !== editTarget.full_name) {
        body.full_name = editName.trim();
      }
      if (editRole !== editTarget.role) {
        body.role = editRole;
      }
      if (Object.keys(body).length === 0) {
        toast.message('Nothing to save');
        return;
      }
      const res = await fetch(`/api/users/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(payload.error ?? 'Update failed');
        return;
      }
      toast.success('User updated');
      setEditTarget(null);
      await fetchMembers();
      if (editTarget.user_id === user?.id) {
        await refreshProfile();
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    setBusyId(member.id);
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ is_active: !member.is_active }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(payload.error ?? 'Update failed');
        return;
      }
      toast.success(member.is_active ? 'User deactivated' : 'User reactivated');
      await fetchMembers();
    } finally {
      setBusyId(null);
    }
  };

  const handleReset = async () => {
    if (!resetTarget) return;
    if (resetPassword.length < 8) {
      toast.error('Temporary password must be at least 8 characters');
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(`/api/users/${resetTarget.id}/reset-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ temp_password: resetPassword }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        toast.error(payload.error ?? 'Reset failed');
        return;
      }
      toast.success(
        'Password reset. Share the new temporary password securely.',
      );
      setResetTarget(null);
      setResetPassword('');
      await fetchMembers();
    } finally {
      setResetting(false);
    }
  };

  const openEdit = (member: TeamMember) => {
    setEditTarget(member);
    setEditRole(member.role);
    setEditName(member.full_name ?? '');
  };

  const openReset = (member: TeamMember) => {
    setResetTarget(member);
    setResetPassword(generateTempPassword());
  };

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1.5">
            <CardTitle className="flex items-center gap-2 text-white">
              <UserCog className="size-4 text-primary" />
              Team
            </CardTitle>
            <CardDescription className="text-slate-400">
              Add teammates, change roles, and reset passwords. Inactive
              members keep their data but can no longer sign in.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={fetchMembers}
              disabled={loading}
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
            >
              <RefreshCcw className="size-4" />
              Refresh
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Add user
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No team members yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const isSelf = m.user_id === user?.id;
                    const ownerCantTouch =
                      callerRole === 'owner' && m.role === 'admin';
                    const disabled = busyId === m.id;
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium text-white">
                          {m.full_name || '—'}
                          {isSelf && (
                            <span className="ml-2 text-xs text-slate-500">
                              (you)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {m.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {ROLE_LABEL[m.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {m.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <span className="size-1.5 rounded-full bg-emerald-400" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <span className="size-1.5 rounded-full bg-slate-500" />
                              Inactive
                            </span>
                          )}
                          {m.must_change_password && (
                            <p className="mt-0.5 text-[11px] text-amber-400">
                              Password reset pending
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={disabled || ownerCantTouch}
                              onClick={() => openEdit(m)}
                              title="Edit user"
                            >
                              <UserCog className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={disabled || ownerCantTouch}
                              onClick={() => openReset(m)}
                              title="Reset password"
                            >
                              <KeyRound className="size-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={disabled || isSelf || ownerCantTouch}
                              onClick={() => handleToggleActive(m)}
                              title={
                                m.is_active ? 'Deactivate' : 'Reactivate'
                              }
                            >
                              {m.is_active ? (
                                <UserX className="size-4 text-red-400" />
                              ) : (
                                <UserCheck className="size-4 text-emerald-400" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a team member</DialogTitle>
            <DialogDescription>
              The user signs in with the temporary password you set here
              and will be prompted to change it immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tm-name">Full name</Label>
              <Input
                id="tm-name"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="Jane Doe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-email">Email</Label>
              <Input
                id="tm-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="jane@company.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-role">Role</Label>
              <select
                id="tm-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                {roleOptions
                  .filter(
                    (r) => r !== 'admin' || canCreateAdmins(callerRole),
                  )
                  .map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-password">Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  id="tm-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setNewPassword(generateTempPassword())}
                  className="border-slate-700"
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={creating}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create user'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit team member</DialogTitle>
            <DialogDescription>
              {editTarget?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tm-edit-name">Full name</Label>
              <Input
                id="tm-edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tm-edit-role">Role</Label>
              <select
                id="tm-edit-role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as Role)}
                disabled={editTarget?.user_id === user?.id}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary disabled:opacity-50"
              >
                {roleOptions
                  .filter(
                    (r) => r !== 'admin' || canCreateAdmins(callerRole),
                  )
                  .map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
              </select>
              {editTarget?.user_id === user?.id && (
                <p className="text-xs text-slate-500">
                  You cannot change your own role.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditTarget(null)}
              disabled={savingEdit}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={savingEdit}>
              {savingEdit ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open) {
            setResetTarget(null);
            setResetPassword('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Sets a new temporary password for{' '}
              <span className="text-white">{resetTarget?.email}</span>.
              The user will be forced to change it on next sign in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tm-reset-password">Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  id="tm-reset-password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setResetPassword(generateTempPassword())}
                  className="border-slate-700"
                >
                  Generate
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetTarget(null)}
              disabled={resetting}
              className="border-slate-700"
            >
              Cancel
            </Button>
            <Button onClick={handleReset} disabled={resetting}>
              {resetting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Resetting…
                </>
              ) : (
                'Reset password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
