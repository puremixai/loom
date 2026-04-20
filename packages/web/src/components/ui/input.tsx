import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md bg-white px-3 py-1 text-sm text-ink-900 shadow-ring-light transition-all placeholder:text-ink-400 hover:shadow-border disabled:opacity-50 disabled:bg-ink-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
