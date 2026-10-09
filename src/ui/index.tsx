import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from 'react';
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

type Variante = 'primary' | 'soft' | 'ghost';
export function Btn({ variante = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  const v = {
    primary: 'bg-brand text-brand-ink hover:opacity-90',
    soft: 'bg-brand-soft text-brand hover:opacity-80',
    ghost: 'border border-line bg-surface text-ink hover:bg-surface-2',
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
