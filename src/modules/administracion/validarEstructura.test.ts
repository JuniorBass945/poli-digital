import { describe, expect, it } from 'vitest';
import {
  GRADOS, MOTIVOS_BAJA_DOCENTE, SECCIONES, etiquetaMotivoDocente, resumenClases, validarAula, validarBajaDocente, validarDocente, validarMateria,
} from './validarEstructura';

describe('docentes, materias y aulas', () => {
  it('el docente exige nombre y un correo válido si se escribe', () => {
    expect(validarDocente({ nombre: '', correo: '' }).nombre).toBeDefined();
    expect(validarDocente({ nombre: 'Prof. Ana', correo: 'no-es-correo' }).correo).toBeDefined();
    expect(validarDocente({ nombre: 'Prof. Ana', correo: '' })).toEqual({});
    expect(validarDocente({ nombre: 'Prof. Ana', correo: 'ana@centro.edu.do' })).toEqual({});
  });
  it('la materia exige nombre', () => {
    expect(validarMateria({ nombre: '  ' }).nombre).toBeDefined();
    expect(validarMateria({ nombre: 'Física' })).toEqual({});
  });
  it('el aula exige grado y sección', () => {
    expect(Object.keys(validarAula({ grado: '', seccion: '' })).sort()).toEqual(['grado', 'seccion']);
    expect(validarAula({ grado: '4.º', seccion: 'A' })).toEqual({});
    expect(GRADOS).toHaveLength(6);
    expect(SECCIONES[0]).toBe('A');
  });
});

describe('baja de docentes', () => {
  it('los códigos no se repiten y solo "otro" exige nota', () => {
    const codigos = MOTIVOS_BAJA_DOCENTE.map((m) => m.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    expect(MOTIVOS_BAJA_DOCENTE.filter((m) => m.requiereNota).map((m) => m.codigo)).toEqual(['otro']);
  });
  it('valida motivo y nota', () => {
    expect(validarBajaDocente('', '')).toMatch(/motivo/i);
    expect(validarBajaDocente('renuncia', '')).toBeNull();
    expect(validarBajaDocente('otro', ' ')).toMatch(/nota/i);
    expect(validarBajaDocente('otro', 'Licencia sin sueldo')).toBeNull();
    expect(etiquetaMotivoDocente('jubilacion')).toBe('Jubilación');
  });
  it('resume las clases en lenguaje natural', () => {
    expect(resumenClases(0, 0)).toBe('Sin clases');
    expect(resumenClases(1, 1)).toBe('1 materia en 1 aula');
    expect(resumenClases(3, 2)).toBe('3 materias en 2 aulas');
  });
});
