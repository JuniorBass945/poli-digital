import { describe, expect, it } from 'vitest';
import { PARTES_VACIAS, TITULOS, componerNombre, leerCoincidencias, partesDe, separarNombre, validarPartes } from './partesNombre';

describe('nombre dividido', () => {
  it('compone título, nombres y apellidos sin espacios de más', () => {
    expect(componerNombre({ titulo: 'Lic.', nombres: ' María  José ', apellido1: 'Pérez', apellido2: 'Gómez' })).toBe('Lic. María José Pérez Gómez');
    expect(componerNombre({ titulo: '', nombres: 'Luis', apellido1: 'Gómez', apellido2: '' })).toBe('Luis Gómez');
  });
  it('exige nombres y primer apellido; el segundo es opcional', () => {
    expect(Object.keys(validarPartes(PARTES_VACIAS)).sort()).toEqual(['apellido1', 'nombres']);
    expect(validarPartes({ titulo: '', nombres: 'Ana', apellido1: 'Gil', apellido2: '' })).toEqual({});
  });
  it('la lista de títulos cumple la regla de la base de datos', () => {
    for (const t of TITULOS) expect(t).toMatch(/^[A-Za-zÁÉÍÓÚáéíóúÑñ.]{2,10}$/);
    expect(TITULOS).toEqual(expect.arrayContaining(['Lic.', 'Licda.', 'Ing.']));
  });
  it('propone cómo dividir un nombre completo viejo', () => {
    expect(separarNombre('Prof. Carmen Peña')).toEqual({ titulo: 'Prof.', nombres: 'Carmen', apellido1: 'Peña', apellido2: '' });
    expect(separarNombre('licda maría pérez gómez')).toEqual({ titulo: 'Licda.', nombres: 'maría', apellido1: 'pérez', apellido2: 'gómez' });
    expect(separarNombre('Ing. María José Pérez Gómez')).toEqual({ titulo: 'Ing.', nombres: 'María José', apellido1: 'Pérez', apellido2: 'Gómez' });
    expect(separarNombre('Madonna')).toEqual({ titulo: '', nombres: 'Madonna', apellido1: '', apellido2: '' });
  });
  it('usa las partes guardadas y, si no las hay, la propuesta', () => {
    expect(partesDe({ nombre: 'X', titulo: 'Lic.', nombres: 'Ana', apellido1: 'Gil', apellido2: null })).toEqual({ titulo: 'Lic.', nombres: 'Ana', apellido1: 'Gil', apellido2: '' });
    expect(partesDe({ nombre: 'Ana Gil', titulo: null, nombres: null, apellido1: null, apellido2: null }).apellido1).toBe('Gil');
  });
  it('lee las coincidencias que devuelve la base de datos', () => {
    expect(leerCoincidencias([{ tipo: 'docente', id: 'd1', nombre: 'Ana Gil', activo: true, tiene_acceso: false, exacta: true }])).toEqual([
      { tipo: 'docente', id: 'd1', nombre: 'Ana Gil', activo: true, tieneAcceso: false, exacta: true },
    ]);
    expect(leerCoincidencias(null)).toEqual([]);
  });
});
