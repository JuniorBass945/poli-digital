import { ROL_ETIQUETA, ordenarRoles, type Rol } from '../../lib/roles';

export type EstadoAcceso = 'activo' | 'pendiente' | 'vencida' | 'sin_acceso';

export interface Acceso {
  id: string;
  nombre: string;
  usuario: string | null;
  correo: string | null;
  activo: boolean;
  roles: Rol[];
  docenteId: string | null;
  estado: EstadoAcceso;
  claveVence: string | null;
  ultimoIngreso: string | null;
}

export const ESTADO_ETIQUETA: Record<EstadoAcceso, string> = {
  activo: 'Activo',
  pendiente: 'Debe cambiar su clave',
  vencida: 'Clave temporal vencida',
  sin_acceso: 'Sin acceso',
};

export const ESTADO_TONO: Record<EstadoAcceso, 'ok' | 'warn' | 'bad' | 'neutral'> = {
  activo: 'ok',
  pendiente: 'warn',
  vencida: 'bad',
  sin_acceso: 'neutral',
};

/** Datos del formulario de un acceso nuevo. */
export interface BorradorAcceso {
  nombre: string;
  usuario: string;
  roles: Rol[];
  /** 'nuevo' = crear el registro de docente; un id = vincular ese docente; '' = sin elegir. */
  docente: string;
}

export function validarBorradorAcceso(b: BorradorAcceso, usuarioFormatoOk: (u: string) => string | null): Record<string, string> {
  const e: Record<string, string> = {};
  if (!b.nombre.trim()) e.nombre = 'Escribe el nombre de la persona.';
  const pu = usuarioFormatoOk(b.usuario);
  if (pu) e.usuario = pu;
  const r = validarRoles(b.roles, b.docente);
  if (r) e.roles = r;
  return e;
}

/** Reglas de los roles de una persona. Devuelve el problema o null. */
export function validarRoles(roles: Rol[], docente: string): string | null {
  if (roles.length === 0) return 'Activa al menos un rol.';
  if (roles.includes('docente') && !docente) return 'El rol Docente necesita un registro de docente: elige uno existente o crea uno nuevo.';
  return null;
}

/** Alterna un rol en la lista (los toggles). Mantiene el orden estándar. */
export function alternarRol(roles: Rol[], rol: Rol): Rol[] {
  return ordenarRoles(roles.includes(rol) ? roles.filter((r) => r !== rol) : [...roles, rol]);
}

/** Convierte la elección del formulario en los parámetros de la base de datos. */
export function paramsDocente(roles: Rol[], docente: string): { docenteId: string | null; crearDocente: boolean } {
  if (!roles.includes('docente')) return { docenteId: null, crearDocente: false };
  if (docente === 'nuevo') return { docenteId: null, crearDocente: true };
  return { docenteId: docente || null, crearDocente: false };
}

/** Texto listo para copiar o pasar a la persona. La clave se muestra una sola vez. */
export function mensajeEntrega(p: { nombre: string; usuario: string; clave: string; vence: string; direccion: string }): string {
  const hasta = new Date(p.vence).toLocaleDateString('es-DO', { day: 'numeric', month: 'long' });
  return [
    `Hola ${p.nombre}, este es tu acceso a Poli Digital:`,
    ``,
    `Dirección: ${p.direccion}`,
    `Usuario: ${p.usuario}`,
    `Clave temporal: ${p.clave}`,
    ``,
    `Al entrar por primera vez el sistema te pedirá crear tu propia clave. La temporal vence el ${hasta}.`,
  ].join('\n');
}

export const resumenRoles = (roles: Rol[]) => ordenarRoles(roles).map((r) => ROL_ETIQUETA[r]);

/** El administrador no puede quitarse a sí mismo el acceso ni restablecerse la clave. */
export const esUnoMismo = (a: Acceso, miId: string | undefined) => !!miId && a.id === miId;
