import { supabase } from '../../lib/supabase';

export type EstadoAviso = 'pendiente' | 'enviado' | 'omitido' | 'cancelado';

export interface Aviso {
  id: string;
  fecha: string;
  estado: EstadoAviso;
  texto: string;
  nota: string | null;
  gestionadoEn: string | null;
  estudiante: { nombres: string; apellidos: string; matricula: string } | null;
  tutor: { nombre: string; parentesco: string | null; telefono: string | null } | null;
}

interface FilaAviso {
  id: string;
  fecha: string;
  estado: EstadoAviso;
  texto: string;
  nota: string | null;
  gestionado_en: string | null;
  estudiantes: Aviso['estudiante'] | Array<NonNullable<Aviso['estudiante']>>;
  tutores: Aviso['tutor'] | Array<NonNullable<Aviso['tutor']>>;
}

const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

export async function listarAvisos(): Promise<Aviso[]> {
  const { data, error } = await supabase
    .from('mensajes')
    .select('id, fecha, estado, texto, nota, gestionado_en, estudiantes(nombres, apellidos, matricula), tutores(nombre, parentesco, telefono)')
    .order('fecha', { ascending: false })
    .order('creado_en', { ascending: false })
    .range(0, 499);
  if (error) throw new Error(`No se pudieron cargar los avisos: ${error.message}`);
  return ((data ?? []) as unknown as FilaAviso[]).map((f) => ({
    id: f.id,
    fecha: f.fecha,
    estado: f.estado,
    texto: f.texto,
    nota: f.nota,
    gestionadoEn: f.gestionado_en,
    estudiante: uno(f.estudiantes),
    tutor: uno(f.tutores),
  }));
}

export async function gestionarAviso(id: string, estado: 'pendiente' | 'enviado' | 'omitido', nota?: string): Promise<void> {
  const { error } = await supabase.rpc('gestionar_aviso', { p_id: id, p_estado: estado, p_nota: nota?.trim() || null });
  if (error) {
    if (error.code === '42501') throw new Error('No tienes permiso para gestionar este aviso.');
    if (error.code === '22023' || error.code === 'P0001') throw new Error(error.message);
    throw new Error(`No se pudo actualizar el aviso: ${error.message}`);
  }
}
