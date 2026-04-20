import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-all disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
  {
    variants: {
      variant: {
        // Primary dark CTA — Vercel Black surface, white text
        default: 'bg-ink-900 text-white hover:bg-black',
        // Secondary with shadow-ring-light border (primary white per DESIGN.md)
        secondary: 'bg-white text-ink-900 shadow-ring-light hover:bg-ink-50',
        // Outline — shadow-border, subtly more pronounced
        outline: 'bg-white text-ink-900 shadow-border hover:bg-ink-50',
        // Ghost — transparent until hover
        ghost: 'text-ink-900 hover:bg-ink-50',
        // Destructive — Ship Red accent on white, per workflow color discipline
        destructive: 'bg-white text-ship-red shadow-ring-light hover:bg-ink-50',
      },
      size: {
        default: 'h-9 px-4 text-sm',
        sm: 'h-8 px-3 text-[13px]',
        lg: 'h-10 px-6 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = 'Button';
