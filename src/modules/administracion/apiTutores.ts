import { supabase } from '../../lib/supabase';
import { traducirError } from './api';
import type { ConsentimientoWhatsapp, Hijo, TutorFila } from './estadoTutor';

interface FilaTutorDb {
  id: string;
  nombre: string;
  parentesco: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
  estudiante_tutor: Array<{ estudiantes: Hijo | Hijo[] | null }> | null;
}

export async function listarTutoresAdmin(): Promise<TutorFila[]> {
  const [tut, con] = await Promise.all([
    supabase
      .from('tutores')
      .select('id, nombre, parentesco, telefono, correo, activo, estudiante_tutor(estudiantes(id, nombres, apellidos, matricula, activo))')
      .order('nombre')
      .range(0, 999),
    supabase.from('consentimientos').select('tutor_id, otorgado, verificado, otorgado_en, evidencia').eq('canal', 'whatsapp').range(0, 999),
  ]);
  if (tut.error) throw traducirError(tut.error);
  if (con.error) throw traducirError(con.error);

  const consentimientos = new Map<string, ConsentimientoWhatsapp>(
    ((con.data ?? []) as Array<{ tutor_id: string; otorgado: boolean; verificado: boolean; otorgado_en: string | null; evidencia: string | null }>).map((c) => [
      c.tutor_id,
      { otorgado: c.otorgado, verificado: c.verificado, otorgadoEn: c.otorgado_en, evidencia: c.evidencia },
    ])
  );

  return ((tut.data ?? []) as unknown as FilaTutorDb[]).map((t) => ({
    id: t.id,
    nombre: t.nombre,
    parentesco: t.parentesco,
    telefono: t.telefono,
    correo: t.correo,
    activo: t.activo,
    hijos: (t.estudiante_tutor ?? [])
      .map((v) => (Array.isArray(v.estudiantes) ? v.estudiantes[0] : v.estudiantes))
      .filter((h): h is Hijo => !!h)
      .sort((a, b) => `${a.apellidos} ${a.nombres}`.localeCompare(`${b.apellidos} ${b.nombres}`, 'es')),
    consentimiento: consentimientos.get(t.id) ?? null,
  }));
}

export async function actualizarTutor(id: string, nombre: string, parentesco: string | null, telefono: string, correo: string | null): Promise<void> {
  const { error } = await supabase.rpc('actualizar_tutor', { p_id: id, p_nombre: nombre, p_parentesco: parentesco, p_telefono: telefono, p_correo: correo });
  if (error) throw traducirError(error);
}

export async function registrarConsentimiento(tutorId: string, otorgado: boolean, verificado: boolean, evidencia: string): Promise<void> {
  const { error } = await supabase.rpc('registrar_consentimiento', {
    p_tutor_id: tutorId,
    p_otorgado: otorgado,
    p_verificado: verificado,
    p_evidencia: evidencia.trim() || null,
    p_canal: 'whatsapp',
  });
  if (error) throw traducirError(error);
}
