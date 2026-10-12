import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Rol } from '../../lib/roles';
import { traducirError } from './api';
import type { PartesNombre } from './partesNombre';
import type { Acceso } from './reglasAcceso';

interface FilaAcceso {
  id: string;
  nombre: string;
  titulo: string | null;
  nombres: string | null;
  apellido1: string | null;
  apellido2: string | null;
  usuario: string | null;
  correo: string | null;
  activo: boolean;
  roles: Rol[];
  docente_id: string | null;
  estado: Acceso['estado'];
  clave_vence: string | null;
  ultimo_ingreso: string | null;
}

export interface ClaveEntregada {
  usuario: string;
  claveTemporal: string;
  vence: string;
}

export async function listarAccesos(): Promise<Acceso[]> {
  const { data, error } = await supabase.rpc('listar_accesos');
  if (error) throw traducirError(error);
  return ((data ?? []) as FilaAcceso[]).map((f) => ({
    id: f.id, nombre: f.nombre, titulo: f.titulo ?? null, nombres: f.nombres ?? null, apellido1: f.apellido1 ?? null, apellido2: f.apellido2 ?? null, usuario: f.usuario, correo: f.correo, activo: f.activo, roles: f.roles,
    docenteId: f.docente_id, estado: f.estado, claveVence: f.clave_vence, ultimoIngreso: f.ultimo_ingreso,
  }));
}

export async function sugerirUsuario(nombre: string): Promise<string> {
  const { data, error } = await supabase.rpc('sugerir_usuario', { p_nombre: nombre });
  if (error) throw traducirError(error);
  return data as string;
}

export async function sugerirUsuarioPartes(p: PartesNombre): Promise<string> {
  const { data, error } = await supabase.rpc('sugerir_usuario_partes', { p_nombres: p.nombres.trim(), p_apellido1: p.apellido1.trim() });
  if (error) throw traducirError(error);
  return data as string;
}

export async function cambiarPersonaAcceso(perfilId: string, p: PartesNombre): Promise<void> {
  const { error } = await supabase.rpc('actualizar_persona_acceso', {
    p_perfil_id: perfilId, p_titulo: p.titulo || null, p_nombres: p.nombres.trim(), p_apellido1: p.apellido1.trim(), p_apellido2: p.apellido2.trim() || null,
  });
  if (error) throw traducirError(error);
}

export async function cambiarRoles(perfilId: string, roles: Rol[], docenteId: string | null, crearDocente: boolean): Promise<void> {
  const { error } = await supabase.rpc('cambiar_roles_acceso', {
    p_perfil_id: perfilId, p_roles: roles, p_docente_id: docenteId, p_crear_docente: crearDocente,
  });
  if (error) throw traducirError(error);
}

export async function renombrarAcceso(perfilId: string, nombre: string): Promise<void> {
  const { error } = await supabase.rpc('renombrar_acceso', { p_perfil_id: perfilId, p_nombre: nombre });
  if (error) throw traducirError(error);
}

// Las operaciones con contraseña pasan por la función del servidor "accesos".
async function llamarServidor<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('accesos', { body: cuerpo });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      try {
        const detalle = (await error.context.json()) as { error?: string };
        if (detalle.error) throw new Error(detalle.error);
      } catch (e) {
        if (e instanceof Error && e.message && !(e instanceof SyntaxError)) throw e;
      }
    }
    throw new Error('No se pudo contactar con el servidor de accesos. Revisa tu conexión o que la función esté desplegada.');
  }
  return data as T;
}

export const crearAcceso = (p: {
  usuario: string; nombre: string; partes: PartesNombre; otraPersona: boolean; roles: Rol[]; docenteId: string | null; crearDocente: boolean; claveManual?: string;
}) => {
  const { partes, ...resto } = p;
  return llamarServidor<ClaveEntregada & { perfilId: string }>({
    accion: 'crear', ...resto,
    titulo: partes.titulo || null, nombres: partes.nombres.trim(), apellido1: partes.apellido1.trim(), apellido2: partes.apellido2.trim() || null,
  });
};

export const reiniciarAcceso = (perfilId: string, claveManual?: string) => llamarServidor<ClaveEntregada>({ accion: 'reiniciar', perfilId, claveManual });

export const quitarAcceso = (perfilId: string) => llamarServidor<{ ok: true }>({ accion: 'quitar', perfilId });
