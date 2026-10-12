import { describe, expect, it } from 'vitest';
import type { PanelAsistencia } from '../../modules/asistencia/api';
import { esDiaHabil, peoresAulas, resumenSemanas, textoTendencia } from './calculos';

const dia = (fecha: string, total: number, presentes: number, tardanzas: number, ausentes: number) =>
  ({ fecha, total, presentes, tardanzas, ausentes, excusas: total - presentes - tardanzas - ausentes, pct: 0 });

describe('comparación de semanas', () => {
  const dias = [
    dia('2026-09-30', 100, 85, 5, 10), dia('2026-10-01', 100, 80, 4, 16),   // semana anterior: 174 de 200
    dia('2026-10-07', 100, 92, 3, 5), dia('2026-10-08', 100, 94, 2, 4),     // esta semana: 191 de 200
  ];
  it('separa esta semana de la anterior y compara', () => {
    const r = resumenSemanas(dias, '2026-10-12');
    expect(r.actual).toEqual({ total: 200, ausentes: 9, pct: 95.5 });
    expect(r.previa.pct).toBe(87);
    expect(r.delta).toBe(8.5);
  });
  it('sin la semana anterior no hay comparación', () => {
    const r = resumenSemanas(dias.slice(2), '2026-10-12');
    expect(r.previa.pct).toBeNull();
    expect(r.delta).toBeNull();
  });
  it('sin datos esta semana el porcentaje es nulo', () => {
    expect(resumenSemanas(dias.slice(0, 2), '2026-10-20').actual.pct).toBeNull();
  });
  it('el día de hoy y los 6 anteriores cuentan como esta semana', () => {
    const r = resumenSemanas([dia('2026-10-06', 10, 10, 0, 0), dia('2026-10-05', 10, 0, 0, 10)], '2026-10-12');
    expect(r.actual.total).toBe(10);
    expect(r.previa.total).toBe(10);
  });
});

describe('textos y ayudas', () => {
  it('describe la tendencia', () => {
    expect(textoTendencia(8.5)).toBe('▲ 8.5 puntos más que la semana anterior');
    expect(textoTendencia(-1)).toBe('▼ 1 punto menos que la semana anterior');
    expect(textoTendencia(0)).toBe('Igual que la semana anterior');
    expect(textoTendencia(null)).toContain('Sin datos');
  });
  it('detecta los días hábiles', () => {
    expect(esDiaHabil('2026-10-12')).toBe(true);   // lunes
    expect(esDiaHabil('2026-10-16')).toBe(true);   // viernes
    expect(esDiaHabil('2026-10-10')).toBe(false);  // sábado
    expect(esDiaHabil('2026-10-11')).toBe(false);  // domingo
  });
  it('elige las aulas con menor asistencia', () => {
    const aulas = [{ aula: 'A', pct: 96 }, { aula: 'B', pct: 78 }, { aula: 'C', pct: 90 }, { aula: 'D', pct: 99 }] as unknown as PanelAsistencia['por_aula'];
    expect(peoresAulas(aulas, 3).map((a) => a.aula)).toEqual(['B', 'C', 'A']);
    expect(peoresAulas(aulas, 1)).toHaveLength(1);
  });
});
