'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ErrorState } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeSchema(mode: 'create' | 'join') {
  return z.object({
    name: z.string().min(1, 'Your name is required').max(255),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'At least 8 characters'),
    companyName:
      mode === 'create'
        ? z.string().trim().min(1, 'Company name is required').max(255)
        : z.string().optional(),
    companyId:
      mode === 'join'
        ? z.string().trim().min(1, 'Company ID is required').regex(UUID_RE, 'That is not a valid company ID')
        : z.string().optional(),
  });
}
type Form = z.infer<ReturnType<typeof makeSchema>>;

export default function RegisterPage() {
  const { register: registerAccount } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(makeSchema(mode)) });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await registerAccount({
        name: values.name,
        email: values.email,
        password: values.password,
        ...(mode === 'create'
          ? { companyName: values.companyName!.trim() }
          : { companyId: values.companyId!.trim() }),
      });
    } catch (e) {
      setServerError((e as Error).message);
    }
  });

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h2 className="text-xl font-semibold text-foreground">Create your account</h2>
        <p className="text-sm text-muted">Start a new company or join an existing one.</p>
      </div>

      {/* Mode toggle */}
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-slate-50 p-1">
        {(['create', 'join'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              'rounded-md py-1.5 text-sm font-medium transition-colors',
              mode === m ? 'bg-surface text-foreground shadow-sm' : 'text-muted hover:text-foreground',
            )}
          >
            {m === 'create' ? 'Create company' : 'Join company'}
          </button>
        ))}
      </div>

      {serverError && <ErrorState message={serverError} />}

      <form onSubmit={onSubmit} className="space-y-4">
        <Input label="Full name" placeholder="Ada Lovelace" error={errors.name?.message} {...register('name')} />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />

        {mode === 'create' ? (
          <Input
            label="Company name"
            placeholder="Acme Inc"
            hint="You'll be the admin of this company."
            error={errors.companyName?.message}
            {...register('companyName')}
          />
        ) : (
          <Input
            label="Company ID"
            placeholder="3f1c9e7a-2b4d-4c8e-9f10-6a2b7c1d0e5f"
            hint="Ask an admin for your company's ID. You'll join as an employee."
            error={errors.companyId?.message}
            {...register('companyId')}
          />
        )}

        <Button type="submit" className="w-full" loading={isSubmitting}>
          {mode === 'create' ? 'Create account & company' : 'Join company'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
