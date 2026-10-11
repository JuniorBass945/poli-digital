import { describe, expect, it } from 'vitest';
import { enlaceWhatsapp, telefonoWhatsapp } from './whatsapp';

describe('teléfonos para WhatsApp', () => {
  it('agrega el 1 de Dominicana a los números de 10 dígitos', () => {
    expect(telefonoWhatsapp('809-555-1234')).toBe('18095551234');
    expect(telefonoWhatsapp('(829) 555 1234')).toBe('18295551234');
    expect(telefonoWhatsapp('8495551234')).toBe('18495551234');
  });
  it('deja pasar números que ya traen código de país', () => {
    expect(telefonoWhatsapp('1-809-555-1234')).toBe('18095551234');
    expect(telefonoWhatsapp('+34 612 345 678')).toBe('34612345678');
  });
  it('rechaza números incompletos o vacíos', () => {
    for (const t of ['', null, undefined, '555-1234', '12345']) expect(telefonoWhatsapp(t)).toBeNull();
  });
  it('arma el enlace con el mensaje codificado', () => {
    const e = enlaceWhatsapp('809-555-1234', 'Hola, ¿cómo está? 100% bien');
    expect(e).toBe('https://wa.me/18095551234?text=' + encodeURIComponent('Hola, ¿cómo está? 100% bien'));
    expect(enlaceWhatsapp('', 'Hola')).toBeNull();
  });
});
