import { useEffect, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/cx';

type Tono = 'neutral' | 'brand' | 'ok' | 'warn' | 'bad' | 'info';
const TONOS: Record<Tono, string> = {
  neutral: 'bg-surface-2 text-muted border-line',
  brand: 'bg-brand-soft text-brand border-transparent',
  ok: 'bg-ok-soft text-ok-ink border-transparent',
  warn: 'bg-warn-soft text-warn-ink border-transparent',
  bad: 'bg-bad-soft text-bad-ink border-transparent',
  info: 'bg-info-soft text-info border-transparent',
};

export function Chip({ tono = 'neutral', children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium', TONOS[tono])}>
      {children}
    </span>
  );
}

type Variante = 'primary' | 'soft' | 'ghost' | 'danger';
export function Btn({ variante = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  const v = {
    primary: 'bg-brand text-brand-ink hover:opacity-90',
    soft: 'bg-brand-soft text-brand hover:opacity-80',
    ghost: 'border border-line bg-surface text-ink hover:bg-surface-2',
    danger: 'bg-bad-soft text-bad-ink hover:opacity-80',
  }[variante];
  return (
    <button
      type="button"
      {...p}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40', v, className)}
    />
  );
}

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cx('rounded-[18px] border border-line bg-surface', className)} />;
}

export function PageHeader({ titulo, desc }: { titulo: string; desc?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold leading-tight sm:text-[26px]">{titulo}</h1>
      {desc && <p className="mt-1 max-w-2xl text-sm text-muted">{desc}</p>}
    </div>
  );
}

export const inputCls =
  'w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-muted';

export function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-muted">{etiqueta}</span>
      {children}
    </label>
  );
}

export function Modal({ titulo, onClose, children, ancho = 'md' }: { titulo: string; onClose: () => void; children: ReactNode; ancho?: 'md' | 'lg' }) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={cx('max-h-[92vh] w-full overflow-auto rounded-t-2xl border border-line bg-surface sm:rounded-2xl', ancho === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md')}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-4 py-3">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button aria-label="Cerrar" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-2">
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export interface TabDef {
  id: string;
  etiqueta: string;
  proximamente?: boolean;
}
export function Tabs({ tabs, valor, onChange }: { tabs: TabDef[]; valor: string; onChange: (id: string) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={valor === t.id}
          disabled={t.proximamente}
          onClick={() => onChange(t.id)}
          className={cx(
            '-mb-px whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium disabled:cursor-not-allowed',
            valor === t.id ? 'border-brand text-brand' : 'border-transparent text-muted enabled:hover:text-ink',
            t.proximamente && 'opacity-50'
          )}
        >
          {t.etiqueta}
          {t.proximamente && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-xs">pronto</span>}
        </button>
      ))}
    </div>
  );
}

export function Aviso({ tono = 'ok', children }: { tono?: 'ok' | 'bad' | 'warn'; children: ReactNode }) {
  const t = { ok: 'border-ok bg-ok-soft text-ok-ink', bad: 'border-bad bg-bad-soft text-bad-ink', warn: 'border-warn bg-warn-soft text-warn-ink' }[tono];
  return (
    <div role={tono === 'bad' ? 'alert' : 'status'} className={cx('rounded-xl border px-4 py-3 text-sm', t)}>
      {children}
    </div>
  );
}
