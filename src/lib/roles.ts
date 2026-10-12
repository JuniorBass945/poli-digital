export type Rol = 'admin' | 'direccion' | 'coordinacion' | 'docente' | 'orientacion' | 'tutor';

export const ROL_ETIQUETA: Record<Rol, string> = {
  admin: 'Administración',
  direccion: 'Dirección',
  coordinacion: 'Coordinación académica',
  docente: 'Docente',
  orientacion: 'Orientación y psicología',
  tutor: 'Tutor o padre',
};

/** Orden en que se muestran los roles (pestañas del Inicio, listas). */
export const ROLES_ORDEN: Rol[] = ['admin', 'direccion', 'coordinacion', 'docente', 'orientacion', 'tutor'];

/** Roles que se pueden dar a una persona del personal. Los tutores no tienen acceso al sistema. */
export const ROLES_ASIGNABLES: Rol[] = ['admin', 'direccion', 'coordinacion', 'docente', 'orientacion'];

export const ROL_DESCRIPCION: Record<Rol, string> = {
  admin: 'Crea y edita datos, accesos y roles. Ve todo.',
  direccion: 'Panel del centro y resúmenes de asistencia. Solo lectura.',
  coordinacion: 'Pasa y corrige la lista de cualquier clase. Ve los resúmenes.',
  docente: 'Pasa lista y gestiona avisos de sus propias clases.',
  orientacion: 'Seguimiento de estudiantes y avisos.',
  tutor: 'Sin acceso al sistema.',
};

/** Quita repetidos y ordena según ROLES_ORDEN. */
export function ordenarRoles(roles: readonly Rol[]): Rol[] {
  return ROLES_ORDEN.filter((r) => roles.includes(r));
}

/** Roles de un perfil. Tolera perfiles viejos que solo traen `rol`. */
export function rolesDe(perfil: { rol: Rol; roles?: readonly Rol[] } | null | undefined): Rol[] {
  if (!perfil) return [];
  return ordenarRoles(perfil.roles && perfil.roles.length > 0 ? perfil.roles : [perfil.rol]);
}

export function tieneRol(perfil: { rol: Rol; roles?: readonly Rol[] } | null | undefined, ...buscados: Rol[]): boolean {
  const mios = rolesDe(perfil);
  return buscados.some((r) => mios.includes(r));
}

/** Orden de alcance (el mismo que usa la base de datos en app.rol_actual): admin y coordinación > docente > dirección > orientación > tutor. */
const ALCANCE: Rol[] = ['admin', 'coordinacion', 'docente', 'direccion', 'orientacion', 'tutor'];

/**
 * Rol de mayor alcance de una persona. Las pantallas que distinguen "puede todo" de "solo sus clases"
 * usan este rol, igual que la base de datos. Ejemplo: docente + coordinación → coordinación (ve todas las clases).
 */
export function rolDeMayorAlcance(roles: readonly Rol[]): Rol {
  return ALCANCE.find((r) => roles.includes(r)) ?? 'tutor';
}

export function etiquetaRoles(roles: readonly Rol[]): string {
  return ordenarRoles(roles).map((r) => ROL_ETIQUETA[r]).join(' · ');
}
