/** Validaciones y normalización de los formularios de administración. */

export const PARENTESCOS = ['Madre', 'Padre', 'Abuela', 'Abuelo', 'Tía', 'Tío', 'Tutor legal', 'Otro'] as const;

export interface MotivoBaja {
  codigo: string;
  etiqueta: string;
  requiereNota: boolean;
}

/** Motivos predeterminados. Los códigos deben coincidir con la restricción de la base de datos. */
export const MOTIVOS_BAJA: MotivoBaja[] = [
  { codigo: 'traslado', etiqueta: 'Traslado a otro centro', requiereNota: false },
  { codigo: 'retiro_voluntario', etiqueta: 'Retiro voluntario', requiereNota: false },
  { codigo: 'cambio_residencia', etiqueta: 'Cambio de residencia', requiereNota: false },
  { codigo: 'inasistencia_prolongada', etiqueta: 'Inasistencia prolongada', requiereNota: false },
  { codigo: 'razones_economicas', etiqueta: 'Razones económicas', requiereNota: false },
  { codigo: 'razones_salud_personales', etiqueta: 'Razones de salud o personales', requiereNota: false },
  { codigo: 'error_registro', etiqueta: 'Error de registro (se creó por equivocación)', requiereNota: false },
  { codigo: 'otro', etiqueta: 'Otro (especificar)', requiereNota: true },
];

export const etiquetaMotivo = (codigo: string | null) =>
  MOTIVOS_BAJA.find((m) => m.codigo === codigo)?.etiqueta ?? codigo ?? '';

/** Devuelve el teléfono como 809-555-1234, o null si no tiene 10 dígitos. Acepta un 1 inicial. */
export function normalizarTelefono(texto: string): string | null {
  let d = texto.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10) return null;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Código de área poco común en Dominicana (aviso suave, no bloquea). */
export function areaInusual(telefonoNormalizado: string): boolean {
  return !['809', '829', '849'].includes(telefonoNormalizado.slice(0, 3));
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CamposEstudiante {
  matricula: string;
  nombres: string;
  apellidos: string;
  aulaId: string;
}
export interface CamposTutor {
  nombre: string;
  telefono: string;
  correo: string;
}
export type Errores = Record<string, string>;

export function validarEstudiante(f: CamposEstudiante): Errores {
  const e: Errores = {};
  if (!f.matricula.trim()) e.matricula = 'Escribe la matrícula.';
  if (!f.nombres.trim()) e.nombres = 'Escribe los nombres.';
  if (!f.apellidos.trim()) e.apellidos = 'Escribe los apellidos.';
  if (!f.aulaId) e.aulaId = 'Elige un aula.';
  return e;
}

export function validarTutor(f: CamposTutor): Errores {
  const e: Errores = {};
  if (!f.nombre.trim()) e.tutorNombre = 'Escribe el nombre del tutor.';
  if (!f.telefono.trim()) e.tutorTelefono = 'Escribe el teléfono del tutor.';
  else if (!normalizarTelefono(f.telefono)) e.tutorTelefono = 'El teléfono debe tener 10 dígitos, por ejemplo 809-555-1234.';
  if (f.correo.trim() && !CORREO.test(f.correo.trim())) e.tutorCorreo = 'El correo no parece válido.';
  return e;
}

export function validarBaja(codigo: string, nota: string): string | null {
  const m = MOTIVOS_BAJA.find((x) => x.codigo === codigo);
  if (!m) return 'Elige un motivo.';
  if (m.requiereNota && !nota.trim()) return 'Escribe una nota que explique el motivo.';
  return null;
}
