import { describe, expect, it } from 'vitest';
import { validarUsuario } from '../../lib/acceso';
import { PARTES_VACIAS } from './partesNombre';
import { alternarRol, esUnoMismo, mensajeEntrega, paramsDocente, validarBorradorAcceso, validarRoles, type Acceso } from './reglasAcceso';

describe('reglas de los accesos', () => {
  it('alternar un rol lo agrega y lo quita, siempre ordenado', () => {
    expect(alternarRol(['docente'], 'admin')).toEqual(['admin', 'docente']);
    expect(alternarRol(['admin', 'docente'], 'admin')).toEqual(['docente']);
  });
  it('exige al menos un rol', () => expect(validarRoles([], '')).toMatch(/al menos un rol/));
  it('el rol docente exige elegir o crear el registro de docente', () => {
    expect(validarRoles(['docente'], '')).toMatch(/registro de docente/);
    expect(validarRoles(['docente'], 'nuevo')).toBeNull();
    expect(validarRoles(['docente'], 'd1')).toBeNull();
    expect(validarRoles(['direccion'], '')).toBeNull();
  });
  it('traduce la elección de docente a parámetros', () => {
    expect(paramsDocente(['docente'], 'nuevo')).toEqual({ docenteId: null, crearDocente: true });
    expect(paramsDocente(['docente'], 'd1')).toEqual({ docenteId: 'd1', crearDocente: false });
    expect(paramsDocente(['direccion'], 'd1')).toEqual({ docenteId: null, crearDocente: false });
  });
  it('revisa nombre, usuario y roles del formulario', () => {
    const e = validarBorradorAcceso({ partes: PARTES_VACIAS, usuario: 'a', roles: [], docente: '' }, validarUsuario);
    expect(Object.keys(e).sort()).toEqual(['apellido1', 'nombres', 'roles', 'usuario']);
    expect(validarBorradorAcceso({ partes: { ...PARTES_VACIAS, nombres: 'Ana', apellido1: 'Gil' }, usuario: 'ana', roles: ['direccion'], docente: '' }, validarUsuario)).toEqual({});
  });
  it('el mensaje de entrega trae usuario, clave y vencimiento', () => {
    const t = mensajeEntrega({ nombre: 'Ana', usuario: 'ana', clave: 'Ab3d-Ef5g-Hj7k', vence: '2026-10-20T12:00:00Z', direccion: 'https://x.test' });
    expect(t).toContain('Usuario: ana');
    expect(t).toContain('Clave temporal: Ab3d-Ef5g-Hj7k');
    expect(t).toContain('https://x.test');
    expect(t).toMatch(/vence el 20 de octubre/);
  });
  it('detecta la propia fila', () => {
    const a = { id: 'u1' } as Acceso;
    expect(esUnoMismo(a, 'u1')).toBe(true);
    expect(esUnoMismo(a, 'u2')).toBe(false);
    expect(esUnoMismo(a, undefined)).toBe(false);
  });
});
