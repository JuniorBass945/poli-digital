import { readSheet } from 'read-excel-file/universal';

const MAX_BYTES = 5 * 1024 * 1024;

/** Lee la primera hoja de un archivo .xlsx y devuelve sus filas. */
export async function leerArchivoExcel(archivo: File): Promise<unknown[][]> {
  if (!archivo.name.toLowerCase().endsWith('.xlsx')) throw new Error('El archivo debe ser de Excel (.xlsx). Si es .xls o .csv, guárdalo como .xlsx.');
  if (archivo.size > MAX_BYTES) throw new Error('El archivo pesa más de 5 MB. Divídelo en partes.');
  try {
    return (await readSheet(archivo)) as unknown[][];
  } catch {
    throw new Error('No se pudo leer el archivo. Comprueba que sea un Excel (.xlsx) válido y que no esté protegido con contraseña.');
  }
}
