/** Validaciones de docentes, materias y aulas. Los códigos de motivos coinciden con la restricción de la base de datos. */

export interface MotivoBajaDocente {
  codigo: string;
  etiqueta: string;
  requiereNota: boolean;
}

export const MOTIVOS_BAJA_DOCENTE: MotivoBajaDocente[] = [
  { codigo: 'renuncia', etiqueta: 'Renuncia', requiereNota: false },
  { codigo: 'traslado', etiqueta: 'Traslado a otro centro', requiereNota: false },
  { codigo: 'jubilacion', etiqueta: 'Jubilación', requiereNota: false },
  { codigo: 'fin_contrato', etiqueta: 'Fin de contrato', requiereNota: false },
  { codigo: 'error_registro', etiqueta: 'Error de registro (se creó por equivocación)', requiereNota: false },
  { codigo: 'otro', etiqueta: 'Otro (especificar)', requiereNota: true },
];

export const etiquetaMotivoDocente = (codigo: string | null) =>
  MOTIVOS_BAJA_DOCENTE.find((m) => m.codigo === codigo)?.etiqueta ?? codigo ?? '';

export const GRADOS = ['1.º', '2.º', '3.º', '4.º', '5.º', '6.º'] as const;
export const SECCIONES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type Errores = Record<string, string>;

export function validarDocente(f: { nombre: string; correo: string }): Errores {
  const e: Errores = {};
  if (!f.nombre.trim()) e.nombre = 'Escribe el nombre del docente.';
  if (f.correo.trim() && !CORREO.test(f.correo.trim())) e.correo = 'El correo no parece válido.';
  return e;
}

export function validarMateria(f: { nombre: string }): Errores {
  const e: Errores = {};
  if (!f.nombre.trim()) e.nombre = 'Escribe el nombre de la materia.';
  return e;
}

export function validarAula(f: { grado: string; seccion: string }): Errores {
  const e: Errores = {};
  if (!f.grado) e.grado = 'Elige el grado.';
  if (!f.seccion) e.seccion = 'Elige la sección.';
  return e;
}

export function validarBajaDocente(codigo: string, nota: string): string | null {
  const m = MOTIVOS_BAJA_DOCENTE.find((x) => x.codigo === codigo);
  if (!m) return 'Elige un motivo.';
  if (m.requiereNota && !nota.trim()) return 'Escribe una nota que explique el motivo.';
  return null;
}

/** Texto como "3 materias en 2 aulas". */
export function resumenClases(materias: number, aulas: number): string {
  if (materias === 0) return 'Sin clases';
  return `${materias} ${materias === 1 ? 'materia' : 'materias'} en ${aulas} ${aulas === 1 ? 'aula' : 'aulas'}`;
}
