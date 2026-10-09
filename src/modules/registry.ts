import { BookOpen, CalendarCheck, ChartColumn, ClipboardList, Database, GraduationCap, HeartHandshake, LayoutDashboard, MessageCircle, Smartphone } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Rol } from '../lib/roles';

/**
 * CATÁLOGO DE MÓDULOS
 * Agregar un módulo = una carpeta en src/modules/<id>/, una entrada aquí y una
 * fila en la tabla modulos_activos. El módulo no aparece para un centro hasta
 * que su bandera esté activa. Ver docs/ARQUITECTURA.md.
 */
export interface ModuloDef {
  id: string;
  etiqueta: string;
  icono: ComponentType<{ size?: number; className?: string }>;
  /** Roles que lo pueden usar (cuando está activo). */
  roles: Rol[];
  /** Entrega del plan en la que se construye. */
  entrega: string;
  descripcion: string;
  /** Siempre disponible, sin bandera. */
  siempre?: boolean;
  /** Carga diferida del código del módulo. */
  cargar: () => Promise<{ default: ComponentType }>;
}

export const MODULOS: ModuloDef[] = [
  { id: 'inicio', etiqueta: 'Inicio', icono: LayoutDashboard, entrega: 'R1', siempre: true,
    roles: ['admin', 'direccion', 'coordinacion', 'docente', 'orientacion', 'tutor'],
    descripcion: 'Resumen de tu sesión y de los módulos del centro.',
    cargar: () => import('../app/Inicio') },
  { id: 'administracion', etiqueta: 'Gestión de datos', icono: Database, entrega: 'R1', roles: ['admin'],
    descripcion: 'Estudiantes, docentes, tutores, materias y asignaciones, con importación desde Excel.',
    cargar: () => import('./administracion') },
  { id: 'asistencia', etiqueta: 'Asistencia', icono: CalendarCheck, entrega: 'R1', roles: ['docente', 'coordinacion'],
    descripcion: 'El docente elige aula y materia y pasa lista; coordinación consulta.',
    cargar: () => import('./asistencia') },
  { id: 'avisos', etiqueta: 'Avisos a tutores', icono: MessageCircle, entrega: 'R1', roles: ['docente', 'coordinacion', 'direccion', 'orientacion'],
    descripcion: 'Avisos a las familias, primero con enlace de WhatsApp y luego automático.',
    cargar: () => import('./avisos') },
  { id: 'calificaciones', etiqueta: 'Calificaciones', icono: GraduationCap, entrega: 'R3', roles: ['docente', 'coordinacion', 'orientacion'],
    descripcion: 'Notas por período, cierres y boletines con código QR.',
    cargar: () => import('./calificaciones') },
  { id: 'actividades', etiqueta: 'Actividades', icono: ClipboardList, entrega: 'R4', roles: ['docente'],
    descripcion: 'Evaluación continua: actividades, pendientes y nota del período calculada.',
    cargar: () => import('./actividades') },
  { id: 'orientacion', etiqueta: 'Seguimiento', icono: HeartHandshake, entrega: 'R5', roles: ['docente', 'orientacion'],
    descripcion: 'Alertas, casos, plan de mejora y notas confidenciales.',
    cargar: () => import('./orientacion') },
  { id: 'portal', etiqueta: 'Mis hijos', icono: Smartphone, entrega: 'R6', roles: ['tutor', 'direccion'],
    descripcion: 'Vista de solo lectura para las familias.',
    cargar: () => import('./portal') },
  { id: 'estadisticas', etiqueta: 'Panel del centro', icono: ChartColumn, entrega: 'R7', roles: ['direccion'],
    descripcion: 'Estadísticas de asistencia, aprobación y estudiantes en riesgo.',
    cargar: () => import('./estadisticas') },
  { id: 'planificacion', etiqueta: 'Planificación', icono: BookOpen, entrega: 'R7', roles: ['docente', 'coordinacion'],
    descripcion: 'Planificación anual o semestral del docente (por confirmar con el centro).',
    cargar: () => import('./planificacion') },
];

export const moduloPorId = (id: string) => MODULOS.find((m) => m.id === id);

/** Módulos que un rol puede ver, dadas las banderas activas del centro. */
export function modulosVisibles(rol: Rol, activos: ReadonlySet<string>): ModuloDef[] {
  return MODULOS.filter((m) => m.roles.includes(rol) && (m.siempre || activos.has(m.id)));
}

/** Módulos del rol que aún no están activos (se muestran como "próximamente"). */
export function modulosPendientes(rol: Rol, activos: ReadonlySet<string>): ModuloDef[] {
  return MODULOS.filter((m) => m.roles.includes(rol) && !m.siempre && !activos.has(m.id));
}
