import { jsx as _jsx } from "react/jsx-runtime";
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';
export const Tabs = TabsPrimitive.Root;
export function TabsList({ className, ...props }) {
    return (_jsx(TabsPrimitive.List, { className: cn('inline-flex h-9 items-center gap-1 rounded-lg bg-ink-50 p-1 text-ink-600 shadow-ring-light', className), ...props }));
}
export function TabsTrigger({ className, ...props }) {
    return (_jsx(TabsPrimitive.Trigger, { className: cn('inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all hover:text-ink-900 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-white data-[state=active]:text-ink-900 data-[state=active]:shadow-ring-light', className), ...props }));
}
export function TabsContent({ className, ...props }) {
    return _jsx(TabsPrimitive.Content, { className: cn('mt-6', className), ...props });
}
