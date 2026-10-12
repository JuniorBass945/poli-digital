import { supabase } from '../../lib/supabase';
import { hoyISO, sumarDias } from '../../lib/fechas';
import { listarClases, panelAsistencia, type Clase, type PanelAsistencia } from '../../modules/asistencia/api';

/** Panel de los últimos 14 días (2 semanas, para comparar), con riesgo desde 3 días con ausencia. */
export function cargarPanel14(): Promise<PanelAsistencia> {
  const hoy = hoyISO();
  return panelAsistencia(sumarDias(hoy, -13), hoy, null, 3);
}

export async function contarAvisosPendientes(): Promise<number> {
  const { count, error } = await supabase.from('mensajes').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export interface ClaseHoy extends Clase {
  listaPasada: boolean;
}

/** Las clases del docente con la marca de si ya pasó lista hoy. */
export async function clasesDeHoy(): Promise<ClaseHoy[]> {
  const hoy = hoyISO();
  const [clases, ses] = await Promise.all([listarClases(), supabase.from('asistencia_sesiones').select('asignacion_id').eq('fecha', hoy).range(0, 999)]);
  if (ses.error) throw new Error(ses.error.message);
  const hechas = new Set(((ses.data ?? []) as Array<{ asignacion_id: string }>).map((s) => s.asignacion_id));
  return clases.map((c) => ({ ...c, listaPasada: hechas.has(c.id) }));
}

export interface PendientesDatos {
  estudiantes_activos: number;
  tutores: number;
  docentes: number;
  aulas: number;
  estudiantes_sin_tutor: number;
  estudiantes_sin_aula: number;
  tutores_sin_telefono: number;
  tutores_sin_consentimiento: number;
  aulas_sin_materias: number;
  docentes_sin_clases: number;
}

export async function pendientesDatos(): Promise<PendientesDatos> {
  const { data, error } = await supabase.rpc('pendientes_datos');
  if (error) throw new Error(error.message);
  return data as PendientesDatos;
}
