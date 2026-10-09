import { describe, expect, it } from 'vitest';
import { MODULOS, modulosPendientes, modulosVisibles } from './registry';

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('catálogo de módulos', () => {
  it('no repite identificadores y todos tienen al menos un rol', () => {
    expect(new Set(ids(MODULOS)).size).toBe(MODULOS.length);
    MODULOS.forEach((m) => expect(m.roles.length).toBeGreaterThan(0));
  });

  it('el inicio está siempre disponible para todos los roles', () => {
    for (const rol of ['admin', 'direccion', 'coordinacion', 'docente', 'orientacion', 'tutor'] as const) {
      expect(ids(modulosVisibles(rol, new Set()))).toContain('inicio');
    }
  });

  it('un módulo sin bandera activa no se muestra', () => {
    expect(ids(modulosVisibles('docente', new Set()))).toEqual(['inicio']);
    expect(ids(modulosVisibles('docente', new Set(['asistencia'])))).toEqual(['inicio', 'asistencia']);
  });

  it('un módulo activo solo se muestra a los roles que le corresponden', () => {
    const activos = new Set(['administracion', 'asistencia', 'portal']);
    expect(ids(modulosVisibles('admin', activos))).toContain('administracion');
    expect(ids(modulosVisibles('docente', activos))).not.toContain('administracion');
    expect(ids(modulosVisibles('tutor', activos))).toEqual(['inicio', 'portal']);
  });

  it('lo no activo aparece como pendiente para el rol', () => {
    const pend = ids(modulosPendientes('tutor', new Set()));
    expect(pend).toEqual(['portal']);
  });
});
