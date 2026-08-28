'use client';

import { useState } from 'react';
import { Copy, Trash2, UserCog } from 'lucide-react';
import type { Role, User } from '@/lib/types';
import { useAuth } from '@/lib/auth-context';
import { useCompany, useDeleteUser, useUpdateUser, useUsers } from '@/lib/query';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/app/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Avatar, Skeleton } from '@/components/ui/misc';
import { RoleBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/app/Pagination';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/app/ConfirmDialog';

const ROLES: Role[] = ['employee', 'manager', 'admin'];

export default function UsersPage() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { data: company } = useCompany();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const { data, isLoading } = useUsers({ page, pageSize });

  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const del = useDeleteUser();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        subtitle={`Manage the people in ${company?.name ?? 'your company'}`}
        action={<InviteButton companyId={company?.id} />}
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted">
                  <th className="py-2.5 pr-3">User</th>
                  <th className="py-2.5 pr-3">Role</th>
                  <th className="py-2.5 pr-3">Joined</th>
                  <th className="py-2.5 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={4} className="py-3">
                          <Skeleton className="h-10 w-full" />
                        </td>
                      </tr>
                    ))
                  : (data?.data ?? []).map((u) => {
                      const isMe = u.id === me?.id;
                      return (
                        <tr key={u.id} className="hover:bg-slate-50/60">
                          <td className="py-3 pr-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={u.name} />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {u.name} {isMe && <span className="text-xs text-muted">(you)</span>}
                                </p>
                                <p className="truncate text-xs text-muted">{u.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-3">
                            <RoleBadge role={u.role} />
                          </td>
                          <td className="py-3 pr-3 text-muted">{formatDate(u.createdAt)}</td>
                          <td className="py-3 pr-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!h-8"
                                onClick={() => setEditUser(u)}
                              >
                                <UserCog className="size-3.5" />
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="!h-8 !w-8 !p-0 text-muted hover:text-danger disabled:opacity-30"
                                disabled={isMe}
                                title={isMe ? 'You cannot delete yourself' : 'Delete user'}
                                onClick={() => setDeleteUser(u)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
          </div>

          {data && (
            <Pagination
              page={data.meta.page}
              pageSize={data.meta.pageSize}
              total={data.meta.total}
              onPage={setPage}
            />
          )}
        </CardBody>
      </Card>

      {editUser && (
        <EditUserModal user={editUser} onClose={() => setEditUser(null)} isSelf={editUser.id === me?.id} />
      )}

      <ConfirmDialog
        open={Boolean(deleteUser)}
        title="Delete user?"
        message={
          deleteUser
            ? `${deleteUser.name} will lose access. Users who own expenses cannot be deleted.`
            : ''
        }
        confirmLabel="Delete"
        danger
        loading={del.isPending}
        onCancel={() => setDeleteUser(null)}
        onConfirm={() => {
          if (!deleteUser) return;
          del.mutate(deleteUser.id, {
            onSuccess: () => {
              toast.push('success', 'User deleted');
              setDeleteUser(null);
            },
            onError: (e) => toast.push('error', (e as Error).message),
          });
        }}
      />
    </div>
  );
}

function InviteButton({ companyId }: { companyId?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Invite user</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Invite a user">
        <div className="space-y-4 text-sm">
          <p className="text-muted">
            In this milestone, new users self-register and join with your company ID. Share the ID
            below along with the sign-up link; new joiners start as <strong>employees</strong> and
            you can promote them here.
          </p>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wide text-muted">
              Company ID
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs">
                {companyId ?? '—'}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (companyId) {
                    navigator.clipboard.writeText(companyId);
                    toast.push('success', 'Company ID copied');
                  }
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-wide text-muted">
              Sign-up link
            </label>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs">
                {typeof window !== 'undefined' ? `${window.location.origin}/register` : '/register'}
              </code>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/register`);
                  toast.push('success', 'Link copied');
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

function EditUserModal({
  user,
  isSelf,
  onClose,
}: {
  user: User;
  isSelf: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const update = useUpdateUser();
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<Role>(user.role);
  const [password, setPassword] = useState('');

  const save = () => {
    const patch: { name?: string; role?: Role; password?: string } = {};
    if (name !== user.name) patch.name = name;
    if (role !== user.role) patch.role = role;
    if (password) patch.password = password;
    if (!Object.keys(patch).length) return onClose();

    update.mutate(
      { id: user.id, patch },
      {
        onSuccess: () => {
          toast.push('success', 'User updated');
          onClose();
        },
        onError: (e) => toast.push('error', (e as Error).message),
      },
    );
  };

  return (
    <Modal open onClose={onClose} title={`Edit ${user.name}`}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
        </div>

        <Select
          label="Role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          hint={isSelf ? 'You cannot remove your own admin role.' : undefined}
        >
          {ROLES.map((r) => (
            <option key={r} value={r} disabled={isSelf && r !== 'admin'}>
              {r[0]!.toUpperCase() + r.slice(1)}
            </option>
          ))}
        </Select>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            Reset password <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave blank to keep current"
            className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {password && password.length < 8 && (
            <p className="text-xs text-danger">Must be at least 8 characters</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            loading={update.isPending}
            disabled={Boolean(password) && password.length < 8}
          >
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  );
}
