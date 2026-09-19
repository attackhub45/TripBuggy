import { create } from 'zustand';

export type ToastKind = 'error' | 'info' | 'success';
export interface Toast { id: string; kind: ToastKind; message: string }

interface ToastState {
  toasts: Toast[];
  pushToast: (message: string, kind?: ToastKind) => void;
  dismissToast: (id: string) => void;
}

let nextId = 0;

/** Global toast queue — see components/ToastHost.tsx for the rendering side. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  pushToast: (message, kind = 'error') => {
    const id = `toast-${nextId++}`;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
