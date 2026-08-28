'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Paperclip, Upload, X } from 'lucide-react';
import { CATEGORY_SUGGESTIONS } from '@/lib/categories';
import { todayIso } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';

const schema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Enter a positive amount (max 2 decimals)')
    .refine((v) => Number(v) > 0, 'Amount must be greater than 0'),
  category: z.string().min(1, 'Category is required').max(100),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date'),
  comment: z.string().max(2000).optional(),
});
export type ExpenseFormValues = z.infer<typeof schema>;

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';

export function ExpenseForm({
  defaultValues,
  submitLabel = 'Submit expense',
  withReceipt = true,
  onSubmit,
  submitting,
}: {
  defaultValues?: Partial<ExpenseFormValues>;
  submitLabel?: string;
  withReceipt?: boolean;
  onSubmit: (values: ExpenseFormValues, receipt: File | null) => void;
  submitting?: boolean;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: defaultValues?.amount ?? '',
      category: defaultValues?.category ?? 'Travel',
      expenseDate: defaultValues?.expenseDate ?? todayIso(),
      comment: defaultValues?.comment ?? '',
    },
  });

  const [receipt, setReceipt] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = (f: File | null) => {
    setFileError(null);
    if (!f) return setReceipt(null);
    if (f.size > MAX_BYTES) {
      setFileError('File is larger than 5 MB');
      return;
    }
    setReceipt(f);
  };

  return (
    <form
      onSubmit={handleSubmit((v) => onSubmit(v, receipt))}
      className="space-y-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Amount"
          inputMode="decimal"
          placeholder="0.00"
          error={errors.amount?.message}
          {...register('amount')}
        />
        <Select label="Category" error={errors.category?.message} {...register('category')}>
          {CATEGORY_SUGGESTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Date"
        type="date"
        max={todayIso()}
        error={errors.expenseDate?.message}
        {...register('expenseDate')}
      />

      <Textarea
        label="Description"
        placeholder="What was this expense for?"
        error={errors.comment?.message}
        {...register('comment')}
      />

      {withReceipt && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Receipt (optional)</label>
          {receipt ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm">
              <span className="flex items-center gap-2 truncate text-foreground">
                <Paperclip className="size-4 shrink-0 text-muted" />
                {receipt.name}
              </span>
              <button
                type="button"
                onClick={() => pickFile(null)}
                className="rounded p-1 text-muted hover:bg-slate-200 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-slate-50 px-3 py-4 text-sm text-muted hover:border-primary hover:text-primary"
            >
              <Upload className="size-4" />
              Click to upload (JPG, PNG, PDF · max 5 MB)
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          {fileError && <p className="text-xs text-danger">{fileError}</p>}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
