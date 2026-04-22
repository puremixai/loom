import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export function DialogContent({ className, children, ...props }) {
    return (_jsxs(DialogPrimitive.Portal, { children: [_jsx(DialogPrimitive.Overlay, { className: "fixed inset-0 z-50 bg-ink-900/20 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=closed]:animate-out" }), _jsxs(DialogPrimitive.Content, { className: cn('fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-card-elevated', className), ...props, children: [children, _jsx(DialogPrimitive.Close, { className: "absolute right-3 top-3 rounded-md p-1.5 text-ink-500 transition-all hover:bg-ink-50 hover:text-ink-900", children: _jsx(X, { className: "h-4 w-4" }) })] })] }));
}
export function DialogHeader({ className, ...props }) {
    return _jsx("div", { className: cn('mb-4 flex flex-col space-y-1', className), ...props });
}
export function DialogTitle({ className, ...props }) {
    return (_jsx(DialogPrimitive.Title, { className: cn('text-[17px] font-semibold tracking-heading text-ink-900', className), ...props }));
}
export const DialogDescription = DialogPrimitive.Description;
export const DialogClose = DialogPrimitive.Close;
