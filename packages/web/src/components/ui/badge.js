import { jsx as _jsx } from "react/jsx-runtime";
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium leading-tight', {
    variants: {
        variant: {
            default: 'bg-ink-900 text-white',
            secondary: 'bg-ink-50 text-ink-600 shadow-ring-light',
            outline: 'bg-white text-ink-900 shadow-ring-light',
            destructive: 'bg-badge-red-bg text-badge-red-text',
            success: 'bg-badge-green-bg text-badge-green-text',
            warning: 'bg-badge-yellow-bg text-badge-yellow-text',
            info: 'bg-badge-blue-bg text-badge-blue-text',
        },
    },
    defaultVariants: { variant: 'default' },
});
export function Badge({ className, variant, ...props }) {
    return _jsx("div", { className: cn(badgeVariants({ variant }), className), ...props });
}
