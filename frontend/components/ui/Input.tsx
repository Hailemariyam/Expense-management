'use client';

import { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

interface FieldProps {
  label?: string;
  error?: string;
  hint?: string;
}

const base =
  'w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted/70 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-primary ' +
  'disabled:opacity-50 disabled:bg-slate-50';

export const Input = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function Input({ className, label, error, hint, id, ...props }, ref) {
  const gen = useId();
  const inputId = id ?? gen;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        className={cn(base, 'h-10', error && 'border-danger focus-visible:ring-danger', className)}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(function Select({ className, label, error, hint, id, children, ...props }, ref) {
  const gen = useId();
  const selectId = id ?? gen;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={cn(base, 'h-10 pr-8', error && 'border-danger', className)}
        {...props}
      >
        {children}
      </select>
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(function Textarea({ className, label, error, hint, id, ...props }, ref) {
  const gen = useId();
  const taId = id ?? gen;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={taId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={taId}
        className={cn(base, 'py-2 min-h-20', error && 'border-danger', className)}
        {...props}
      />
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
});
