import { describe, expect, it } from 'vitest';
import type { PanelAsistencia } from './api';
import { csvRiesgo, rangoPeriodo, tonoPorcentaje } from './resumenPanel';

describe('períodos del resumen', () => {
  it('calcula los rangos terminando hoy', () => {
    expect(rangoPeriodo('7', '2026-10-10')).toEqual({ desde: '2026-10-04', hasta: '2026-10-10' });
    expect(rangoPeriodo('30', '2026-10-10')).toEqual({ desde: '2026-09-11', hasta: '2026-10-10' });
    expect(rangoPeriodo('mes', '2026-10-10')).toEqual({ desde: '2026-10-01', hasta: '2026-10-10' });
    expect(rangoPeriodo('7', '2027-01-03')).toEqual({ desde: '2026-12-28', hasta: '2027-01-03' });
  });
  it('colorea el porcentaje de asistencia', () => {
    expect(tonoPorcentaje(95)).toBe('ok');
    expect(tonoPorcentaje(90)).toBe('ok');
    expect(tonoPorcentaje(89.9)).toBe('warn');
    expect(tonoPorcentaje(80)).toBe('warn');
    expect(tonoPorcentaje(79.9)).toBe('bad');
    expect(tonoPorcentaje(null)).toBe('neutral');
  });
});

describe('CSV de estudiantes en riesgo', () => {
  it('trae encabezado, BOM, comillas escapadas y fechas dd/mm/aaaa', () => {
    const p = {
      en_riesgo: [
        { estudiante_id: '1', nombre: 'Rosario, Starlin "Sta"', matricula: 'P26-1', dias_ausente: 5, tardanzas: 2, ultima_ausencia: '2026-10-09', aula: '4.º A, Informática' },
        { estudiante_id: '2', nombre: 'Díaz, Eva', matricula: 'P26-2', dias_ausente: 3, tardanzas: 0, ultima_ausencia: null, aula: null },
      ],
    } as unknown as PanelAsistencia;
    const csv = csvRiesgo(p);
    expect(csv.startsWith('\ufeff"Estudiante"')).toBe(true);
    const lineas = csv.split('\r\n');
    expect(lineas).toHaveLength(3);
    expect(lineas[1]).toBe('"Rosario, Starlin ""Sta""","P26-1","4.º A, Informática","5","2","09/10/2026"');
    expect(lineas[2]).toBe('"Díaz, Eva","P26-2","","3","0",""');
  });
});
