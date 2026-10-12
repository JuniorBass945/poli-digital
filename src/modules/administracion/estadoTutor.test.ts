import { describe, expect, it } from 'vitest';
import { ETIQUETA_ESTADO, estadoWhatsapp } from './estadoTutor';

const consent = (otorgado: boolean, verificado: boolean) => ({ otorgado, verificado, otorgadoEn: otorgado ? '2026-08-15T12:00:00Z' : null, evidencia: otorgado ? 'x' : null });

describe('estado de WhatsApp de un tutor', () => {
  it('sin teléfono, nada más importa', () => {
    expect(estadoWhatsapp({ telefono: null, consentimiento: consent(true, true) })).toBe('sin_telefono');
    expect(estadoWhatsapp({ telefono: '  ', consentimiento: null })).toBe('sin_telefono');
  });
  it('pendiente cuando no hay consentimiento registrado u otorgado', () => {
    expect(estadoWhatsapp({ telefono: '809-555-1234', consentimiento: null })).toBe('pendiente');
    expect(estadoWhatsapp({ telefono: '809-555-1234', consentimiento: consent(false, false) })).toBe('pendiente');
  });
  it('otorgado y verificado', () => {
    expect(estadoWhatsapp({ telefono: '809-555-1234', consentimiento: consent(true, false) })).toBe('otorgado');
    expect(estadoWhatsapp({ telefono: '809-555-1234', consentimiento: consent(true, true) })).toBe('verificado');
  });
  it('cada estado tiene su etiqueta', () => {
    expect(Object.keys(ETIQUETA_ESTADO).sort()).toEqual(['otorgado', 'pendiente', 'sin_telefono', 'verificado']);
  });
});
