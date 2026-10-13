import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ToastViewport, type ToastItem, type ToastTone } from '../../shared/ui/Toast';

export interface ToastApi { toast: (message: string, opts?: { title?: string; tone?: ToastTone; duration?: number }) => number; dismiss: (id: number) => void }
const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback<ToastApi['toast']>((message, opts = {}) => {
    const id = ++seq.current;
    const duration = opts.duration ?? (opts.tone === 'danger' ? 6000 : 3500);
    setItems((list) => [...list.slice(-3), { id, message, title: opts.title, tone: opts.tone ?? 'info', duration }]);
    if (duration > 0) setTimeout(() => dismiss(id), duration);
    return id;
  }, [dismiss]);
  const api = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
