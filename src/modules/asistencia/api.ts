import { supabase } from '../../lib/supabase';

export type Estado = 'presente' | 'ausente' | 'tardanza' | 'excusa';

export interface Clase {
  id: string;
  aulaId: string;
  aula: string;
  materia: string;
  docente: string | null;
  etiqueta: string;
}

export interface EstudianteLista {
  id: string;
  nombres: string;
  apellidos: string;
  matricula: string;
}

export interface ListaCargada {
  estudiantes: EstudianteLista[];
  estados: Record<string, Estado>;
  registradoEn: string | null;
}

export interface ResultadoGuardado {
  total: number;
  presentes: number;
  ausentes: number;
  tardanzas: number;
  excusas: number;
  avisos_creados: number;
  avisos_existentes: number;
  ausentes_sin_tutor: string[];
}

function mensajeDe(e: { message: string; code?: string }): Error {
  if (e.code === '42501') return new Error('No tienes permiso para hacer esto.');
  if (e.code === '22023' || e.code === 'P0001') return new Error(e.message);
  return new Error(`No se pudo completar la acción: ${e.message}`);
}

export async function listarClases(): Promise<Clase[]> {
  const [asig, aulas, materias, docentes] = await Promise.all([
    supabase.from('asignaciones').select('id, aula_id, materia_id, docente_id').eq('activo', true).range(0, 999),
    supabase.from('aulas').select('id, grado, seccion, especialidad').range(0, 999),
    supabase.from('materias').select('id, nombre').range(0, 999),
    supabase.from('docentes').select('id, nombre').range(0, 999),
  ]);
  if (asig.error) throw mensajeDe(asig.error);
  if (aulas.error) throw mensajeDe(aulas.error);
  if (materias.error) throw mensajeDe(materias.error);

  const aulaPorId = new Map(((aulas.data ?? []) as Array<{ id: string; grado: string; seccion: string; especialidad: string | null }>).map((a) => [a.id, a]));
  const materiaPorId = new Map(((materias.data ?? []) as Array<{ id: string; nombre: string }>).map((m) => [m.id, m.nombre]));
  const docentePorId = new Map((((docentes.error ? [] : docentes.data) ?? []) as Array<{ id: string; nombre: string }>).map((d) => [d.id, d.nombre]));

  return ((asig.data ?? []) as Array<{ id: string; aula_id: string; materia_id: string; docente_id: string }>)
    .map((a) => {
      const au = aulaPorId.get(a.aula_id);
      const aula = au ? `${au.grado} ${au.seccion}${au.especialidad ? `, ${au.especialidad}` : ''}` : 'Aula';
      const materia = materiaPorId.get(a.materia_id) ?? 'Materia';
      return { id: a.id, aulaId: a.aula_id, aula, materia, docente: docentePorId.get(a.docente_id) ?? null, etiqueta: `${aula} · ${materia}` };
    })
    .sort((x, y) => x.etiqueta.localeCompare(y.etiqueta, 'es'));
}

export async function cargarLista(aulaId: string, asignacionId: string, fecha: string): Promise<ListaCargada> {
  const [mats, asis, ses] = await Promise.all([
    supabase.from('matriculas').select('estudiante_id, estudiantes(id, nombres, apellidos, matricula)').eq('aula_id', aulaId).eq('estado', 'activa').range(0, 999),
    supabase.from('asistencias').select('estudiante_id, estado').eq('asignacion_id', asignacionId).eq('fecha', fecha).range(0, 999),
    supabase.from('asistencia_sesiones').select('registrado_en').eq('asignacion_id', asignacionId).eq('fecha', fecha).range(0, 0),
  ]);
  if (mats.error) throw mensajeDe(mats.error);
  if (asis.error) throw mensajeDe(asis.error);
  if (ses.error) throw mensajeDe(ses.error);

  const estudiantes = ((mats.data ?? []) as unknown as Array<{ estudiantes: EstudianteLista | EstudianteLista[] | null }>)
    .map((m) => (Array.isArray(m.estudiantes) ? m.estudiantes[0] : m.estudiantes))
    .filter((e): e is EstudianteLista => !!e)
    .sort((a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es'));

  const guardados = new Map(((asis.data ?? []) as Array<{ estudiante_id: string; estado: Estado }>).map((r) => [r.estudiante_id, r.estado]));
  const estados: Record<string, Estado> = {};
  for (const e of estudiantes) estados[e.id] = guardados.get(e.id) ?? 'presente';

  const sesion = ((ses.data ?? []) as Array<{ registrado_en: string }>)[0];
  return { estudiantes, estados, registradoEn: sesion?.registrado_en ?? null };
}

export async function guardarAsistencia(asignacionId: string, fecha: string, estados: Record<string, Estado>): Promise<ResultadoGuardado> {
  const registros = Object.entries(estados).map(([estudiante_id, estado]) => ({ estudiante_id, estado }));
  const { data, error } = await supabase.rpc('guardar_asistencia', { p_asignacion_id: asignacionId, p_fecha: fecha, p_registros: registros });
  if (error) throw mensajeDe(error);
  return data as ResultadoGuardado;
}
