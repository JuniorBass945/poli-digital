import { describe, expect, it } from 'vitest';
import { aISO, fechaLarga, formatoCorto, sumarDias } from './fechas';

describe('fechas', () => {
  it('formatea la fecha local sin desfase de zona horaria', () => {
    expect(aISO(new Date(2026, 9, 10, 23, 59))).toBe('2026-10-10');
    expect(aISO(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
  it('suma y resta días cruzando meses y años', () => {
    expect(sumarDias('2026-10-10', -3)).toBe('2026-10-07');
    expect(sumarDias('2026-10-01', -1)).toBe('2026-09-30');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2028-03-01', -1)).toBe('2028-02-29');
  });
  it('da formatos legibles', () => {
    expect(formatoCorto('2026-10-10')).toBe('10/10/2026');
    expect(fechaLarga('2026-10-10')).toContain('octubre');
    expect(fechaLarga('2026-10-10')).toContain('2026');
  });
});
