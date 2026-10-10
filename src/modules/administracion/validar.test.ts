import { describe, expect, it } from 'vitest';
import { MOTIVOS_BAJA, areaInusual, etiquetaMotivo, normalizarTelefono, validarBaja, validarEstudiante, validarTutor } from './validar';

describe('teléfonos', () => {
  it('normaliza distintos formatos al mismo', () => {
    for (const t of ['809-555-1234', '8095551234', '(809) 555-1234', '809 555 1234', '+1 809 555 1234', '18095551234']) {
      expect(normalizarTelefono(t)).toBe('809-555-1234');
    }
  });
  it('rechaza números incompletos o con demasiados dígitos', () => {
    for (const t of ['', '555-1234', '809-555-123', '809555123456']) expect(normalizarTelefono(t)).toBeNull();
  });
  it('avisa de códigos de área poco comunes', () => {
    expect(areaInusual('809-555-1234')).toBe(false);
    expect(areaInusual('829-555-1234')).toBe(false);
    expect(areaInusual('849-555-1234')).toBe(false);
    expect(areaInusual('212-555-1234')).toBe(true);
  });
});

describe('estudiante y tutor', () => {
  it('exige matrícula, nombres, apellidos y aula', () => {
    expect(Object.keys(validarEstudiante({ matricula: ' ', nombres: '', apellidos: '', aulaId: '' })).sort()).toEqual(['apellidos', 'aulaId', 'matricula', 'nombres']);
    expect(validarEstudiante({ matricula: 'P26-1', nombres: 'Ana', apellidos: 'Pérez', aulaId: 'x' })).toEqual({});
  });
  it('exige nombre y un teléfono válido del tutor; el correo es opcional pero debe ser válido', () => {
    expect(Object.keys(validarTutor({ nombre: '', telefono: '', correo: '' })).sort()).toEqual(['tutorNombre', 'tutorTelefono']);
    expect(validarTutor({ nombre: 'Rosa', telefono: '123', correo: '' }).tutorTelefono).toMatch(/10 dígitos/);
    expect(validarTutor({ nombre: 'Rosa', telefono: '809-555-1234', correo: 'no-es-correo' }).tutorCorreo).toBeDefined();
    expect(validarTutor({ nombre: 'Rosa', telefono: '809-555-1234', correo: 'rosa@correo.com' })).toEqual({});
    expect(validarTutor({ nombre: 'Rosa', telefono: '809-555-1234', correo: '' })).toEqual({});
  });
});

describe('motivos de baja', () => {
  it('no repite códigos y "otro" es el único que exige nota', () => {
    const codigos = MOTIVOS_BAJA.map((m) => m.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(MOTIVOS_BAJA.filter((m) => m.requiereNota).map((m) => m.codigo)).toEqual(['otro']);
  });
  it('valida el motivo y la nota', () => {
    expect(validarBaja('', '')).toMatch(/motivo/i);
    expect(validarBaja('traslado', '')).toBeNull();
    expect(validarBaja('otro', '   ')).toMatch(/nota/i);
    expect(validarBaja('otro', 'Cambio de país')).toBeNull();
    expect(validarBaja('inventado', '')).toMatch(/motivo/i);
  });
  it('muestra etiquetas legibles', () => {
    expect(etiquetaMotivo('traslado')).toBe('Traslado a otro centro');
    expect(etiquetaMotivo(null)).toBe('');
  });
});
