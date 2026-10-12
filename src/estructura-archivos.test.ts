import { describe, expect, it } from 'vitest';

describe('estructura de archivos', () => {
  it('no tiene archivos duplicados en la misma carpeta ignorando mayúsculas y minúsculas', () => {
    const archivos = Object.keys(import.meta.glob('/src/**/*.{ts,tsx}'));
    const porCarpeta = new Map<string, string[]>();

    for (const archivo of archivos) {
      const limpio = archivo.replace(/\\/g, '/');
      const carpeta = limpio.includes('/') ? limpio.slice(0, limpio.lastIndexOf('/')) : '.';
      const nombre = limpio.split('/').pop() ?? '';
      const base = nombre.replace(/\.[^.]+$/, '').toLowerCase();
      if (!base) continue;

      const clave = `${carpeta}|${base}`;
      const entradas = porCarpeta.get(clave) ?? [];
      entradas.push(limpio);
      porCarpeta.set(clave, entradas);
    }

    const conflictos = [...porCarpeta.entries()]
      .filter(([, rutas]) => rutas.length > 1)
      .map(([clave, rutas]) => ({ clave, rutas }));

    expect(conflictos).toEqual([]);
  });
});
