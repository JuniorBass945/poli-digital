/**
 * "Clase de trabajo": la clase (aula + materia) que el docente eligió y con la que trabaja
 * en asistencia, avisos y, más adelante, notas. Se recuerda en este navegador.
 */
const CLAVE = 'poli:claseTrabajo';

export function leerClaseTrabajo(): string | null {
  try {
    return window.localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function guardarClaseTrabajo(asignacionId: string): void {
  try {
    window.localStorage.setItem(CLAVE, asignacionId);
  } catch {
    /* sin almacenamiento: no pasa nada, solo no se recuerda */
  }
}
