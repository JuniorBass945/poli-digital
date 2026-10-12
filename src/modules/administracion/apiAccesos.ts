import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import type { Rol } from '../../lib/roles';
import { traducirError } from './api';
import type { Acceso } from './reglasAcceso';

interface FilaAcceso {
  id: string;
  nombre: string;
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
    id: f.id, nombre: f.nombre, usuario: f.usuario, correo: f.correo, activo: f.activo, roles: f.roles,
    docenteId: f.docente_id, estado: f.estado, claveVence: f.clave_vence, ultimoIngreso: f.ultimo_ingreso,
  }));
}

export async function sugerirUsuario(nombre: string): Promise<string> {
  const { data, error } = await supabase.rpc('sugerir_usuario', { p_nombre: nombre });
  if (error) throw traducirError(error);
  return data as string;
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

export const crearAcceso = (p: { usuario: string; nombre: string; roles: Rol[]; docenteId: string | null; crearDocente: boolean; claveManual?: string }) =>
  llamarServidor<ClaveEntregada & { perfilId: string }>({ accion: 'crear', ...p });

export const reiniciarAcceso = (perfilId: string, claveManual?: string) => llamarServidor<ClaveEntregada>({ accion: 'reiniciar', perfilId, claveManual });

export const quitarAcceso = (perfilId: string) => llamarServidor<{ ok: true }>({ accion: 'quitar', perfilId });
