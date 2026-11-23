import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastAction { label: string; onClick: () => void; }
interface ToastState { id: number; text: string; action?: ToastAction; }

const Ctx = createContext<(text: string, action?: ToastAction) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback((text: string, action?: ToastAction) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setT({ id, text, action });
    timer.current = setTimeout(() => setT((cur) => (cur?.id === id ? null : cur)), action ? 5000 : 2400);
  }, []);
  return (
    <Ctx.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(104px+var(--sa-bottom))] z-[60] flex justify-center px-4 lg:bottom-6">
        {t && (
          <div key={t.id} role="status" className="anim-rise pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-3 rounded-2xl bg-ink py-1.5 pl-4 pr-1.5 text-sm font-semibold text-bg shadow-2xl">
            <span className="flex-1">{t.text}</span>
            {t.action && (
              <button className="min-h-10 rounded-xl bg-bg px-4 font-bold text-ink" onClick={() => { t.action?.onClick(); setT(null); }}>
                {t.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
