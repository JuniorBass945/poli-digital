const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha local como AAAA-MM-DD (sin pasar por UTC). */
export function aISO(d: Date): string {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export const hoyISO = () => aISO(new Date());

export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  return aISO(new Date(a, m - 1, d + dias));
}

/** 10/10/2026 */
export function formatoCorto(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

/** sábado, 10 de octubre de 2026 */
export function fechaLarga(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-DO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(a, m - 1, d));
}
