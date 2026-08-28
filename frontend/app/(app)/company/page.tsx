'use client';

import { useState } from 'react';
import { Building2, Copy, Users as UsersIcon } from 'lucide-react';
import { useCompany, useRenameCompany } from '@/lib/query';
import { formatDate } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/app/PageHeader';
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageLoader, ErrorState } from '@/components/ui/misc';

export default function CompanyPage() {
  const { data: company, isLoading, isError, error } = useCompany();

  if (isLoading) return <PageLoader />;
  if (isError) return <ErrorState message={(error as Error).message} />;
  if (!company) return null;

  // Remount the editor when the company changes so its local state re-seeds.
  return <CompanyView key={company.id} company={company} />;
}

function CompanyView({ company }: { company: NonNullable<ReturnType<typeof useCompany>['data']> }) {
  const toast = useToast();
  const rename = useRenameCompany();
  const [name, setName] = useState(company.name);

  const dirty = name.trim() !== company.name && name.trim().length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Company" subtitle="Your organization's settings" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <UsersIcon className="size-4" />
            <span className="text-sm">Users</span>
          </div>
          <p className="mt-1 text-2xl font-semibold text-foreground">{company.userCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-center gap-2 text-muted">
            <Building2 className="size-4" />
            <span className="text-sm">Created</span>
          </div>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {formatDate(company.createdAt)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <Input
            label="Company name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
          />
          <div className="flex justify-end">
            <Button
              disabled={!dirty}
              loading={rename.isPending}
              onClick={() =>
                rename.mutate(name.trim(), {
                  onSuccess: () => toast.push('success', 'Company name updated'),
                  onError: (e) => toast.push('error', (e as Error).message),
                })
              }
            >
              Save
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Company ID</CardTitle>
        </CardHeader>
        <CardBody className="space-y-2">
          <p className="text-sm text-muted">
            Share this with new team members so they can join during sign-up (they&apos;ll start as
            employees).
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs">
              {company.id}
            </code>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(company.id);
                toast.push('success', 'Copied');
              }}
            >
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
