import { sumarDias } from '../../lib/fechas';
import type { PanelAsistencia } from '../../modules/asistencia/api';

export interface ResumenSemana {
  total: number;
  ausentes: number;
  pct: number | null;
}

const redondear = (n: number) => Math.round(n * 10) / 10;

function resumir(dias: PanelAsistencia['por_dia']): ResumenSemana {
  const total = dias.reduce((s, d) => s + d.total, 0);
  const buenos = dias.reduce((s, d) => s + d.presentes + d.tardanzas, 0);
  return { total, ausentes: dias.reduce((s, d) => s + d.ausentes, 0), pct: total === 0 ? null : redondear((100 * buenos) / total) };
}

/** Separa los días del panel en "esta semana" (los últimos 7 días hasta hoy) y "la semana anterior", y compara. */
export function resumenSemanas(dias: PanelAsistencia['por_dia'], hoy: string) {
  const corte = sumarDias(hoy, -6);
  const actual = resumir(dias.filter((d) => d.fecha >= corte));
  const previa = resumir(dias.filter((d) => d.fecha < corte));
  const delta = actual.pct !== null && previa.pct !== null ? redondear(actual.pct - previa.pct) : null;
  return { actual, previa, delta };
}

/** Las n aulas con menor asistencia. */
export function peoresAulas(porAula: PanelAsistencia['por_aula'], n = 3) {
  return [...porAula].sort((a, b) => a.pct - b.pct).slice(0, n);
}

/** Lunes a viernes. */
export function esDiaHabil(iso: string): boolean {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = new Date(a, m - 1, d).getDay();
  return dia >= 1 && dia <= 5;
}

/** "▲ 1.2 puntos más que la semana anterior" / "▼ ..." / "igual que ...". */
export function textoTendencia(delta: number | null): string {
  if (delta === null) return 'Sin datos de la semana anterior para comparar';
  if (delta === 0) return 'Igual que la semana anterior';
  const puntos = Math.abs(delta) === 1 ? 'punto' : 'puntos';
  return delta > 0 ? `▲ ${delta} ${puntos} más que la semana anterior` : `▼ ${Math.abs(delta)} ${puntos} menos que la semana anterior`;
}
