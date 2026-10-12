import { sumarDias } from '../../lib/fechas';
import type { PanelAsistencia } from './api';

export type Periodo = '7' | '30' | 'mes' | 'otro';

/** Rango de fechas de cada período, terminando hoy. */
export function rangoPeriodo(periodo: Exclude<Periodo, 'otro'>, hoy: string): { desde: string; hasta: string } {
  if (periodo === '7') return { desde: sumarDias(hoy, -6), hasta: hoy };
  if (periodo === '30') return { desde: sumarDias(hoy, -29), hasta: hoy };
  return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
}

/** Color según el porcentaje de asistencia: 90 o más bien, 80 a 90 atención, menos de 80 problema. */
export function tonoPorcentaje(pct: number | null): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (pct === null) return 'neutral';
  if (pct >= 90) return 'ok';
  if (pct >= 80) return 'warn';
  return 'bad';
}

const comillas = (t: string) => `"${t.replace(/"/g, '""')}"`;
const corta = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');

/** CSV (abre bien en Excel) con los estudiantes en riesgo del período. */
export function csvRiesgo(p: PanelAsistencia): string {
  const lineas = [['Estudiante', 'Matrícula', 'Aula', 'Días con ausencia', 'Tardanzas', 'Última ausencia'].map(comillas).join(',')];
  for (const r of p.en_riesgo) {
    lineas.push([r.nombre, r.matricula, r.aula ?? '', String(r.dias_ausente), String(r.tardanzas), corta(r.ultima_ausencia)].map(comillas).join(','));
  }
  return '\ufeff' + lineas.join('\r\n');
}
