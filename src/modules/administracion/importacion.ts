/** Lectura y normalización de la plantilla de estudiantes (sin dependencias de pantalla). */

export const CAMPOS = [
  'matricula', 'nombres', 'apellidos', 'fecha_nacimiento', 'grado', 'seccion', 'especialidad',
  'tutor_nombre', 'tutor_parentesco', 'tutor_telefono', 'tutor_correo',
] as const;
export type Campo = (typeof CAMPOS)[number];

export const OBLIGATORIOS: Campo[] = ['matricula', 'nombres', 'apellidos', 'grado', 'seccion', 'tutor_nombre', 'tutor_telefono'];

export const TITULOS: Record<Campo, string> = {
  matricula: 'Matrícula',
  nombres: 'Nombres',
  apellidos: 'Apellidos',
  fecha_nacimiento: 'Fecha de nacimiento',
  grado: 'Grado',
  seccion: 'Sección',
  especialidad: 'Especialidad',
  tutor_nombre: 'Nombre del tutor',
  tutor_parentesco: 'Parentesco',
  tutor_telefono: 'Teléfono del tutor',
  tutor_correo: 'Correo del tutor',
};

// Nombres alternativos de las columnas (ya sin tildes, en minúscula y sin espacios ni signos).
const SINONIMOS: Record<Campo, string[]> = {
  matricula: ['matricula', 'nomatricula', 'numerodematricula', 'codigo', 'codigodeestudiante'],
  nombres: ['nombres', 'nombre', 'nombresdelestudiante', 'nombredelestudiante'],
  apellidos: ['apellidos', 'apellido', 'apellidosdelestudiante'],
  fecha_nacimiento: ['fechadenacimiento', 'fechanacimiento', 'nacimiento', 'fnacimiento'],
  grado: ['grado', 'curso', 'nivel'],
  seccion: ['seccion', 'sec', 'grupo'],
  especialidad: ['especialidad', 'modalidad', 'area', 'carrera'],
  tutor_nombre: ['nombredeltutor', 'nombretutor', 'tutor', 'nombredelpadre', 'representante', 'padreotutor'],
  tutor_parentesco: ['parentesco', 'parentescodeltutor', 'relacion'],
  tutor_telefono: ['telefonodeltutor', 'telefonotutor', 'telefono', 'celular', 'whatsapp', 'tel'],
  tutor_correo: ['correodeltutor', 'correotutor', 'correo', 'email', 'correoelectronico'],
};

export type FilaImportacion = Record<Campo, string> & { fila: number };

export function normalizarEncabezado(texto: unknown): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export interface MapaColumnas {
  indice: Partial<Record<Campo, number>>;
  faltantes: Campo[];
}

/** Busca cada campo en la fila de títulos (sin importar tildes, mayúsculas ni el orden de las columnas). */
export function mapearColumnas(encabezados: unknown[]): MapaColumnas {
  const norm = encabezados.map(normalizarEncabezado);
  const indice: Partial<Record<Campo, number>> = {};
  for (const campo of CAMPOS) {
    const i = norm.findIndex((h) => h !== '' && SINONIMOS[campo].includes(h));
    if (i >= 0) indice[campo] = i;
  }
  return { indice, faltantes: OBLIGATORIOS.filter((c) => indice[c] === undefined) };
}

const dosDigitos = (n: number) => String(n).padStart(2, '0');

/** Convierte una celda a texto. Las fechas de Excel pasan a AAAA-MM-DD. */
export function celdaATexto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return '';
    return `${valor.getUTCFullYear()}-${dosDigitos(valor.getUTCMonth() + 1)}-${dosDigitos(valor.getUTCDate())}`;
  }
  if (typeof valor === 'number') return Number.isInteger(valor) ? String(valor) : String(valor);
  if (typeof valor === 'boolean') return '';
  return String(valor).trim();
}

/** Acepta 2010-05-03, 03/05/2010 y 03-05-2010. Si la fecha no existe (31/02/2010) la devuelve igual para que se marque el error. */
export function normalizarFecha(texto: string): string {
  const t = texto.trim();
  if (t === '') return '';
  const dmy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t);
  if (!dmy) return t;
  const [, d, m, a] = dmy;
  const fecha = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d)));
  const existe = fecha.getUTCFullYear() === Number(a) && fecha.getUTCMonth() === Number(m) - 1 && fecha.getUTCDate() === Number(d);
  return existe ? `${a}-${dosDigitos(Number(m))}-${dosDigitos(Number(d))}` : t;
}

export interface ResultadoLectura {
  filas: FilaImportacion[];
  faltantes: Campo[];
  filaEncabezados: number;
}

/** Toma las filas de la primera hoja: la primera con datos son los títulos; las filas vacías se saltan. */
export function filasDesdeMatriz(matriz: unknown[][]): ResultadoLectura {
  const vacia = (fila: unknown[]) => fila.every((c) => celdaATexto(c) === '');
  const iTitulos = matriz.findIndex((f) => !vacia(f));
  if (iTitulos < 0) return { filas: [], faltantes: [...OBLIGATORIOS], filaEncabezados: 0 };
  const { indice, faltantes } = mapearColumnas(matriz[iTitulos]);
  if (faltantes.length > 0) return { filas: [], faltantes, filaEncabezados: iTitulos + 1 };

  const filas: FilaImportacion[] = [];
  for (let i = iTitulos + 1; i < matriz.length; i++) {
    const origen = matriz[i];
    if (vacia(origen)) continue;
    const fila = { fila: i + 1 } as FilaImportacion;
    for (const campo of CAMPOS) {
      const col = indice[campo];
      fila[campo] = col === undefined ? '' : celdaATexto(origen[col]);
    }
    fila.fecha_nacimiento = normalizarFecha(fila.fecha_nacimiento);
    filas.push(fila);
  }
  return { filas, faltantes: [], filaEncabezados: iTitulos + 1 };
}

// ---------- Informe devuelto por la base de datos ----------
export interface FilaInforme {
  fila: number;
  estado: 'ok' | 'advertencia' | 'error';
  mensajes: string[];
  accion: string;
  matricula: string;
  estudiante: string;
  aula: string;
  tutor: string;
}

export interface InformeImportacion {
  simulacion: boolean;
  total: number;
  ok: number;
  advertencias: number;
  errores: number;
  importados: number;
  tutores_nuevos: number;
  tutores_reutilizados: number;
  filas: FilaInforme[];
}

const comillas = (t: string) => `"${t.replace(/"/g, '""')}"`;

/** CSV (abre bien en Excel) con las filas que tienen advertencias o errores. */
export function csvDeProblemas(informe: InformeImportacion): string {
  const lineas = [['Fila', 'Matrícula', 'Estudiante', 'Estado', 'Detalle'].map(comillas).join(',')];
  for (const f of informe.filas.filter((x) => x.estado !== 'ok')) {
    lineas.push([String(f.fila), f.matricula, f.estudiante, f.estado === 'error' ? 'Error (se omite)' : 'Advertencia', f.mensajes.join(' ')].map(comillas).join(','));
  }
  return '\ufeff' + lineas.join('\r\n');
}
