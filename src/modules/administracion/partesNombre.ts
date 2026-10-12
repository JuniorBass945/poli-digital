/** Nombre dividido: título abreviado, nombres, 1.er apellido y 2.º apellido (opcional). */

export interface PartesNombre {
  titulo: string;
  nombres: string;
  apellido1: string;
  apellido2: string;
}

export const PARTES_VACIAS: PartesNombre = { titulo: '', nombres: '', apellido1: '', apellido2: '' };

/** Títulos abreviados que se pueden elegir. Coinciden con la regla de la base de datos (2 a 10 letras y punto). */
export const TITULOS = ['Lic.', 'Licda.', 'Ing.', 'Inga.', 'Dr.', 'Dra.', 'Arq.', 'Arqa.', 'MSc.', 'Mag.', 'Prof.', 'Profa.', 'Lcdo.', 'Lcda.'] as const;

const TITULOS_MIN = new Set(TITULOS.map((t) => t.toLowerCase().replace('.', '')));

const espacios = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Nombre completo tal como se guarda y se muestra: "Lic. María José Pérez Gómez". */
export function componerNombre(p: PartesNombre): string {
  return espacios([p.titulo, p.nombres, p.apellido1, p.apellido2].filter((x) => x.trim()).join(' '));
}

export function validarPartes(p: PartesNombre): Record<string, string> {
  const e: Record<string, string> = {};
  if (!p.nombres.trim()) e.nombres = 'Escribe los nombres.';
  if (!p.apellido1.trim()) e.apellido1 = 'Escribe el primer apellido.';
  return e;
}

/**
 * Para editar registros viejos que solo tienen un nombre completo: propone cómo dividirlo.
 * 1 palabra = nombres; 2 = nombre y apellido; 3 = nombre y dos apellidos; 4 o más = dos nombres y dos apellidos.
 * Es solo una propuesta: la persona la corrige en el formulario.
 */
export function separarNombre(completo: string): PartesNombre {
  let palabras = espacios(completo).split(' ').filter(Boolean);
  let titulo = '';
  if (palabras.length > 1 && TITULOS_MIN.has(palabras[0].toLowerCase().replace('.', ''))) {
    const t = palabras[0].replace('.', '');
    titulo = TITULOS.find((x) => x.toLowerCase().replace('.', '') === t.toLowerCase()) ?? '';
    palabras = palabras.slice(1);
  }
  const n = palabras.length;
  if (n <= 1) return { titulo, nombres: palabras.join(' '), apellido1: '', apellido2: '' };
  if (n === 2) return { titulo, nombres: palabras[0], apellido1: palabras[1], apellido2: '' };
  if (n === 3) return { titulo, nombres: palabras[0], apellido1: palabras[1], apellido2: palabras[2] };
  return { titulo, nombres: palabras.slice(0, n - 2).join(' '), apellido1: palabras[n - 2], apellido2: palabras[n - 1] };
}

/** Partes guardadas, o una propuesta a partir del nombre completo si el registro es anterior a la división. */
export function partesDe(r: { nombre: string; titulo: string | null; nombres: string | null; apellido1: string | null; apellido2: string | null }): PartesNombre {
  if (r.nombres && r.apellido1) {
    return { titulo: r.titulo ?? '', nombres: r.nombres, apellido1: r.apellido1, apellido2: r.apellido2 ?? '' };
  }
  return separarNombre(r.nombre);
}

/** Coincidencia con una persona que ya existe en el centro (viene de `buscar_personas`). */
export interface Coincidencia {
  tipo: 'docente' | 'acceso';
  id: string;
  nombre: string;
  activo: boolean;
  tieneAcceso: boolean;
  exacta: boolean;
}

export function leerCoincidencias(data: unknown): Coincidencia[] {
  return ((data ?? []) as Array<Record<string, unknown>>).map((x) => ({
    tipo: x.tipo as Coincidencia['tipo'],
    id: x.id as string,
    nombre: x.nombre as string,
    activo: x.activo as boolean,
    tieneAcceso: x.tiene_acceso as boolean,
    exacta: x.exacta as boolean,
  }));
}
