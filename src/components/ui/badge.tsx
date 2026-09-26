import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide',
  {
    variants: {
      variant: {
        neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
        baru: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
        add: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
        over: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
        warn: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />;
}
