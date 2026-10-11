import { supabase } from '../../lib/supabase';
import { traducirError } from './api';
import type { FilaImportacion, InformeImportacion } from './importacion';

/** Revisa (simular = true) o guarda (simular = false) las filas del Excel. */
export async function importarEstudiantes(filas: FilaImportacion[], simular: boolean): Promise<InformeImportacion> {
  const { data, error } = await supabase.rpc('importar_estudiantes', { p_filas: filas, p_simular: simular });
  if (error) throw traducirError(error);
  return data as InformeImportacion;
}
