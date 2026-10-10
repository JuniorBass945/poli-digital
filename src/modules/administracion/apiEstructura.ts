import { supabase } from '../../lib/supabase';
import { traducirError } from './api';
import type { Asignacion, AulaCompleta, Docente, Materia } from './tiposEstructura';

interface Ok {
  error: { message: string; code?: string } | null;
}
const revisar = ({ error }: Ok) => {
  if (error) throw traducirError(error);
};

// ---------- Lecturas ----------
export async function listarDocentes(): Promise<Docente[]> {
  const { data, error } = await supabase
    .from('docentes')
    .select('id, nombre, correo, activo, baja_motivo, baja_nota, perfil_id')
    .order('nombre')
    .range(0, 999);
  if (error) throw traducirError(error);
  return ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
    id: d.id as string,
    nombre: d.nombre as string,
    correo: (d.correo as string | null) ?? null,
    activo: d.activo as boolean,
    bajaMotivo: (d.baja_motivo as string | null) ?? null,
    bajaNota: (d.baja_nota as string | null) ?? null,
    perfilId: (d.perfil_id as string | null) ?? null,
  }));
}

export async function listarMaterias(): Promise<Materia[]> {
  const { data, error } = await supabase.from('materias').select('id, nombre, codigo, activo').order('nombre').range(0, 999);
  if (error) throw traducirError(error);
  return (data ?? []) as Materia[];
}

export async function listarAulasCompletas(): Promise<AulaCompleta[]> {
  const { data, error } = await supabase
    .from('aulas')
    .select('id, grado, seccion, especialidad, guia_id, activo')
    .order('grado')
    .order('seccion')
    .range(0, 999);
  if (error) throw traducirError(error);
  return ((data ?? []) as Array<Record<string, unknown>>).map((a) => ({
    id: a.id as string,
    grado: a.grado as string,
    seccion: a.seccion as string,
    especialidad: (a.especialidad as string | null) ?? null,
    guiaId: (a.guia_id as string | null) ?? null,
    activo: a.activo as boolean,
  }));
}

export async function listarAsignaciones(): Promise<Asignacion[]> {
  const { data, error } = await supabase
    .from('asignaciones')
    .select('id, aula_id, materia_id, docente_id')
    .eq('activo', true)
    .range(0, 4999);
  if (error) throw traducirError(error);
  return ((data ?? []) as Array<Record<string, string>>).map((a) => ({
    id: a.id,
    aulaId: a.aula_id,
    materiaId: a.materia_id,
    docenteId: a.docente_id,
  }));
}

export async function anioEscolarActual(): Promise<string | null> {
  const { data, error } = await supabase.from('anios_escolares').select('nombre').eq('actual', true).range(0, 0);
  if (error) throw traducirError(error);
  return ((data ?? []) as Array<{ nombre: string }>)[0]?.nombre ?? null;
}

export async function estudiantesPorAula(): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc('resumen_estudiantes_por_aula');
  if (error) throw traducirError(error);
  return new Map(((data ?? []) as Array<{ aula_id: string; activos: number | string }>).map((r) => [r.aula_id, Number(r.activos)]));
}

// ---------- Docentes ----------
export async function crearDocente(nombre: string, correo: string | null) {
  revisar(await supabase.rpc('crear_docente', { p_nombre: nombre, p_correo: correo }));
}
export async function actualizarDocente(id: string, nombre: string, correo: string | null) {
  revisar(await supabase.rpc('actualizar_docente', { p_id: id, p_nombre: nombre, p_correo: correo }));
}
export async function darBajaDocente(id: string, motivo: string, nota: string) {
  revisar(await supabase.rpc('dar_baja_docente', { p_id: id, p_motivo: motivo, p_nota: nota.trim() || null }));
}
export async function reactivarDocente(id: string) {
  revisar(await supabase.rpc('reactivar_docente', { p_id: id }));
}

// ---------- Materias ----------
export async function crearMateria(nombre: string, codigo: string | null) {
  revisar(await supabase.rpc('crear_materia', { p_nombre: nombre, p_codigo: codigo }));
}
export async function actualizarMateria(id: string, nombre: string, codigo: string | null) {
  revisar(await supabase.rpc('actualizar_materia', { p_id: id, p_nombre: nombre, p_codigo: codigo }));
}
export async function archivarMateria(id: string) {
  revisar(await supabase.rpc('archivar_materia', { p_id: id }));
}
export async function reactivarMateria(id: string) {
  revisar(await supabase.rpc('reactivar_materia', { p_id: id }));
}

// ---------- Aulas ----------
export async function crearAula(grado: string, seccion: string, especialidad: string | null, guiaId: string | null) {
  revisar(await supabase.rpc('crear_aula', { p_grado: grado, p_seccion: seccion, p_especialidad: especialidad, p_guia_id: guiaId }));
}
export async function actualizarAula(id: string, grado: string, seccion: string, especialidad: string | null, guiaId: string | null) {
  revisar(await supabase.rpc('actualizar_aula', { p_id: id, p_grado: grado, p_seccion: seccion, p_especialidad: especialidad, p_guia_id: guiaId }));
}
export async function archivarAula(id: string) {
  revisar(await supabase.rpc('archivar_aula', { p_id: id }));
}
export async function reactivarAula(id: string) {
  revisar(await supabase.rpc('reactivar_aula', { p_id: id }));
}

// ---------- Asignaciones ----------
export async function asignarMateria(aulaId: string, materiaId: string, docenteId: string) {
  revisar(await supabase.rpc('asignar_materia', { p_aula_id: aulaId, p_materia_id: materiaId, p_docente_id: docenteId }));
}
export async function cambiarDocenteAsignacion(id: string, docenteId: string) {
  revisar(await supabase.rpc('cambiar_docente_asignacion', { p_id: id, p_docente_id: docenteId }));
}
export async function quitarAsignacion(id: string) {
  revisar(await supabase.rpc('quitar_asignacion', { p_id: id }));
}
