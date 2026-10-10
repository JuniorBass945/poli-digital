import { supabase } from '../../lib/supabase';
import type { Aula, DatosEstudiante, DatosTutor, EstudianteFila, TutorResumen } from './tipos';

interface ErrorDb {
  message: string;
  code?: string;
}

/** Convierte los errores de la base de datos en mensajes claros para la persona. */
export function traducirError(e: ErrorDb): Error {
  if (e.code === '23505' && /matricula/i.test(e.message)) return new Error('Ya existe un estudiante con esa matrícula.');
  if (e.code === '23505') return new Error('Ese registro ya existe.');
  if (e.code === '42501') return new Error('No tienes permiso para hacer esto.');
  if (e.code === '22023' || e.code === 'P0001') return new Error(e.message);
  return new Error(`No se pudo completar la acción: ${e.message}`);
}

interface FilaEstudianteDb {
  id: string;
  matricula: string;
  nombres: string;
  apellidos: string;
  fecha_nacimiento: string | null;
  activo: boolean;
  baja_en: string | null;
  baja_motivo: string | null;
  baja_nota: string | null;
  matriculas: Array<{ aula_id: string; estado: string }> | null;
  estudiante_tutor: Array<{ principal: boolean; tutores: TutorResumen | null }> | null;
}

export async function listarAulas(): Promise<Aula[]> {
  const { data, error } = await supabase
    .from('aulas')
    .select('id, grado, seccion, especialidad, anio_escolar_id')
    .eq('activo', true)
    .order('grado')
    .order('seccion');
  if (error) throw traducirError(error);
  return (data ?? []) as Aula[];
}

export async function listarEstudiantes(): Promise<EstudianteFila[]> {
  const { data, error } = await supabase
    .from('estudiantes')
    .select(
      'id, matricula, nombres, apellidos, fecha_nacimiento, activo, baja_en, baja_motivo, baja_nota, matriculas(aula_id, estado), estudiante_tutor(principal, tutores(id, nombre, parentesco, telefono, correo))'
    )
    .order('apellidos')
    .order('nombres')
    .range(0, 999);
  if (error) throw traducirError(error);
  return ((data ?? []) as unknown as FilaEstudianteDb[]).map((f) => {
    const mats = f.matriculas ?? [];
    const mat = mats.find((m) => m.estado === 'activa') ?? mats[0];
    const vinculos = f.estudiante_tutor ?? [];
    const principal = vinculos.find((v) => v.principal) ?? vinculos[0];
    return {
      id: f.id,
      matricula: f.matricula,
      nombres: f.nombres,
      apellidos: f.apellidos,
      fechaNacimiento: f.fecha_nacimiento,
      activo: f.activo,
      bajaEn: f.baja_en,
      bajaMotivo: f.baja_motivo,
      bajaNota: f.baja_nota,
      aulaId: mat?.aula_id ?? null,
      tutor: principal?.tutores ?? null,
    };
  });
}

export async function listarTutores(): Promise<TutorResumen[]> {
  const { data, error } = await supabase
    .from('tutores')
    .select('id, nombre, parentesco, telefono, correo')
    .eq('activo', true)
    .order('nombre')
    .range(0, 999);
  if (error) throw traducirError(error);
  return (data ?? []) as TutorResumen[];
}

export async function crearEstudiante(est: DatosEstudiante, tutor: { id: string } | DatosTutor): Promise<string> {
  const { data, error } = await supabase.rpc('crear_estudiante', {
    p_matricula: est.matricula,
    p_nombres: est.nombres,
    p_apellidos: est.apellidos,
    p_aula_id: est.aulaId,
    p_fecha_nacimiento: est.fechaNacimiento,
    p_tutor_id: 'id' in tutor ? tutor.id : null,
    p_tutor_nombre: 'id' in tutor ? null : tutor.nombre,
    p_tutor_parentesco: 'id' in tutor ? null : tutor.parentesco,
    p_tutor_telefono: 'id' in tutor ? null : tutor.telefono,
    p_tutor_correo: 'id' in tutor ? null : tutor.correo,
  });
  if (error) throw traducirError(error);
  return data as string;
}

export async function actualizarEstudiante(id: string, est: DatosEstudiante, tutor: DatosTutor | null): Promise<void> {
  const { error } = await supabase.rpc('actualizar_estudiante', {
    p_id: id,
    p_matricula: est.matricula,
    p_nombres: est.nombres,
    p_apellidos: est.apellidos,
    p_aula_id: est.aulaId,
    p_fecha_nacimiento: est.fechaNacimiento,
    p_tutor_nombre: tutor?.nombre ?? null,
    p_tutor_parentesco: tutor?.parentesco ?? null,
    p_tutor_telefono: tutor?.telefono ?? null,
    p_tutor_correo: tutor?.correo ?? null,
  });
  if (error) throw traducirError(error);
}

export async function darDeBaja(id: string, motivo: string, nota: string): Promise<void> {
  const { error } = await supabase.rpc('dar_baja_estudiante', { p_id: id, p_motivo: motivo, p_nota: nota.trim() || null });
  if (error) throw traducirError(error);
}

export async function reactivarEstudiante(id: string): Promise<void> {
  const { error } = await supabase.rpc('reactivar_estudiante', { p_id: id });
  if (error) throw traducirError(error);
}
