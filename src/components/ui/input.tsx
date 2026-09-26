import * as React from 'react';
import { cn } from '@/lib/utils';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-11 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-900 dark:placeholder:text-neutral-500 dark:focus-visible:ring-neutral-100',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export { Input };
