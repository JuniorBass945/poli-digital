import { describe, expect, it } from 'vitest';
import fuenteFuncion from '../../supabase/functions/accesos/index.ts?raw';
import { DOMINIO_INTERNO, credencialAEmail, validarClaveNueva, validarClaveTemporal, validarUsuario } from './acceso';
import { etiquetaRoles, ordenarRoles, rolDeMayorAlcance, rolesDe } from './roles';

describe('acceso por usuario', () => {
  it('convierte el usuario en el correo interno, sin importar mayúsculas ni espacios', () => {
    expect(credencialAEmail('  CPena ')).toBe(`cpena@${DOMINIO_INTERNO}`);
  });
  it('respeta un correo completo (usuarios antiguos)', () => {
    expect(credencialAEmail(' admin@polidemo.test ')).toBe('admin@polidemo.test');
  });
  it('el dominio interno es igual en la función del servidor', () => {
    expect(fuenteFuncion).toContain(`const DOMINIO_INTERNO = '${DOMINIO_INTERNO}';`);
  });
  it('valida el formato del usuario', () => {
    expect(validarUsuario('cpena')).toBeNull();
    expect(validarUsuario('c.pena-2')).toBeNull();
    expect(validarUsuario('')).toMatch(/Escribe/);
    expect(validarUsuario('ab')).toMatch(/3 a 30/);
    expect(validarUsuario('carmén')).toMatch(/sin tildes/);
    expect(validarUsuario('a b c')).toMatch(/3 a 30/);
  });
});

describe('clave nueva', () => {
  it('acepta una clave válida', () => expect(validarClaveNueva('Escuela2026', 'Escuela2026')).toBeNull());
  it('exige 8 caracteres', () => expect(validarClaveNueva('Ab1', 'Ab1')).toMatch(/8 caracteres/));
  it('exige letras y números', () => {
    expect(validarClaveNueva('sololetras', 'sololetras')).toMatch(/letras y números/);
    expect(validarClaveNueva('12345678', '12345678')).toMatch(/letras y números/);
  });
  it('exige que coincidan', () => expect(validarClaveNueva('Escuela2026', 'Escuela2027')).toMatch(/no coinciden/));
  it('no admite repetir la temporal', () => expect(validarClaveNueva('Temp-1234', 'Temp-1234', 'Temp-1234')).toMatch(/temporal/));
});

describe('clave temporal escrita a mano', () => {
  it('acepta una clave con letras y números', () => expect(validarClaveTemporal('Escuela2026', 'cpena')).toBeNull());
  it('exige 8 caracteres, letras y números', () => {
    expect(validarClaveTemporal('Ab1')).toMatch(/8 caracteres/);
    expect(validarClaveTemporal('sololetras')).toMatch(/letras y números/);
    expect(validarClaveTemporal('12345678')).toMatch(/letras y números/);
  });
  it('no puede ser igual al usuario ni pasar de 72 caracteres', () => {
    expect(validarClaveTemporal('Cpena123', 'cpena123')).toMatch(/igual al usuario/);
    expect(validarClaveTemporal('a1'.repeat(40))).toMatch(/72/);
  });
  it('la función del servidor aplica la misma regla', () => {
    expect(fuenteFuncion).toContain('function elegirClave');
    expect(fuenteFuncion).toContain('manual.length < 8');
    expect(fuenteFuncion).toContain('manual.length > 72');
  });
});

describe('varios roles', () => {
  it('ordena sin repetidos', () => expect(ordenarRoles(['orientacion', 'admin', 'docente'])).toEqual(['admin', 'docente', 'orientacion']));
  it('el rol de mayor alcance sigue el mismo orden que la base de datos', () => {
    expect(rolDeMayorAlcance(['docente', 'coordinacion'])).toBe('coordinacion');
    expect(rolDeMayorAlcance(['direccion', 'docente'])).toBe('docente');
    expect(rolDeMayorAlcance(['orientacion', 'direccion'])).toBe('direccion');
    expect(rolDeMayorAlcance(['admin', 'docente'])).toBe('admin');
  });
  it('un perfil viejo con un solo rol sigue funcionando', () => {
    expect(rolesDe({ rol: 'docente' })).toEqual(['docente']);
    expect(rolesDe({ rol: 'docente', roles: ['docente', 'orientacion'] })).toEqual(['docente', 'orientacion']);
    expect(rolesDe(null)).toEqual([]);
  });
  it('escribe los roles juntos', () => expect(etiquetaRoles(['orientacion', 'docente'])).toBe('Docente · Orientación y psicología'));
});
