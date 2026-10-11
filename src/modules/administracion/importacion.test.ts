import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readSheet } from 'read-excel-file/universal';
import { describe, expect, it } from 'vitest';
import golden from './fixtures/estudiantes_simulados.json';
import {
  CAMPOS, OBLIGATORIOS, celdaATexto, csvDeProblemas, filasDesdeMatriz, mapearColumnas, normalizarEncabezado, normalizarFecha, type InformeImportacion,
} from './importacion';

const TITULOS = ['Matrícula', 'Nombres', 'Apellidos', 'Fecha de nacimiento', 'Grado', 'Sección', 'Especialidad', 'Nombre del tutor', 'Parentesco', 'Teléfono del tutor', 'Correo del tutor'];

describe('títulos de columnas', () => {
  it('ignora tildes, mayúsculas, espacios y signos', () => {
    expect(normalizarEncabezado('  Teléfono del Tutor ')).toBe('telefonodeltutor');
    expect(normalizarEncabezado('Matrícula:')).toBe('matricula');
    expect(normalizarEncabezado(null)).toBe('');
  });
  it('mapea la plantilla completa', () => {
    const { indice, faltantes } = mapearColumnas(TITULOS);
    expect(faltantes).toEqual([]);
    expect(Object.keys(indice)).toHaveLength(CAMPOS.length);
    expect(indice.tutor_telefono).toBe(9);
  });
  it('acepta otros nombres y otro orden de columnas', () => {
    const { indice, faltantes } = mapearColumnas(['Apellidos', 'Nombre', 'No. Matrícula', 'Curso', 'Grupo', 'Tutor', 'Celular']);
    expect(faltantes).toEqual([]);
    expect(indice).toMatchObject({ apellidos: 0, nombres: 1, matricula: 2, grado: 3, seccion: 4, tutor_nombre: 5, tutor_telefono: 6 });
  });
  it('informa las columnas obligatorias que faltan', () => {
    const { faltantes } = mapearColumnas(['Matrícula', 'Nombres', 'Apellidos']);
    expect(faltantes).toEqual(['grado', 'seccion', 'tutor_nombre', 'tutor_telefono']);
    expect(OBLIGATORIOS).toHaveLength(7);
  });
});

describe('celdas y fechas', () => {
  it('convierte celdas a texto', () => {
    expect(celdaATexto(null)).toBe('');
    expect(celdaATexto('  Ana ')).toBe('Ana');
    expect(celdaATexto(8095551234)).toBe('8095551234');
    expect(celdaATexto(true)).toBe('');
    expect(celdaATexto(new Date(Date.UTC(2010, 4, 3)))).toBe('2010-05-03');
  });
  it('normaliza las fechas y deja pasar las inválidas para que se marquen', () => {
    expect(normalizarFecha('2010-05-03')).toBe('2010-05-03');
    expect(normalizarFecha('03/05/2010')).toBe('2010-05-03');
    expect(normalizarFecha('3-5-2010')).toBe('2010-05-03');
    expect(normalizarFecha('31/02/2010')).toBe('31/02/2010');
    expect(normalizarFecha('')).toBe('');
  });
});

describe('filas del archivo', () => {
  it('salta filas vacías y respeta el número de fila de Excel', () => {
    const r = filasDesdeMatriz([[], TITULOS, ['A-1', 'Ana', 'Pérez', null, '4.º', 'A', null, 'Rosa', 'Madre', '809-555-1234', null], [null, null], ['A-2', 'Luis', 'Gómez', new Date(Date.UTC(2011, 0, 9)), '4', 'b', 'Informática', 'Juan', '', 8295551234, 'j@c.test']]);
    expect(r.faltantes).toEqual([]);
    expect(r.filaEncabezados).toBe(2);
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toMatchObject({ fila: 3, matricula: 'A-1', fecha_nacimiento: '', tutor_telefono: '809-555-1234' });
    expect(r.filas[1]).toMatchObject({ fila: 5, fecha_nacimiento: '2011-01-09', grado: '4', seccion: 'b', tutor_telefono: '8295551234' });
  });
  it('si faltan columnas obligatorias no devuelve filas', () => {
    const r = filasDesdeMatriz([['Matrícula', 'Nombres'], ['A-1', 'Ana']]);
    expect(r.filas).toEqual([]);
    expect(r.faltantes).toContain('tutor_telefono');
  });
  it('un archivo vacío se reconoce', () => {
    const r = filasDesdeMatriz([[], [null]]);
    expect(r.filaEncabezados).toBe(0);
    expect(r.faltantes).toHaveLength(7);
  });
});

describe('Excel simulado de ejemplo (docs/ejemplos/estudiantes_simulados.xlsx)', () => {
  it('se lee completo y coincide con el resultado esperado fila por fila', async () => {
    const buf = readFileSync(fileURLToPath(new URL('../../../docs/ejemplos/estudiantes_simulados.xlsx', import.meta.url)));
    const matriz = (await readSheet(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))) as unknown[][];
    const r = filasDesdeMatriz(matriz);
    expect(r.faltantes).toEqual([]);
    expect(r.filas).toHaveLength(102);
    const esperado = (golden as Array<Record<string, string | number>>).map(({ _nota, ...resto }) => { void _nota; return resto; });
    expect(r.filas).toEqual(esperado);
  });
});

describe('informe de problemas en CSV', () => {
  it('incluye solo advertencias y errores, con comillas escapadas y BOM', () => {
    const informe: InformeImportacion = {
      simulacion: true, total: 3, ok: 1, advertencias: 1, errores: 1, importados: 2, tutores_nuevos: 2, tutores_reutilizados: 0,
      filas: [
        { fila: 2, estado: 'ok', mensajes: [], accion: 'tutor nuevo', matricula: 'A-1', estudiante: 'Ana Pérez', aula: '4.º A', tutor: 'Rosa' },
        { fila: 3, estado: 'advertencia', mensajes: ['El correo no es válido.'], accion: '', matricula: 'A-2', estudiante: 'Luis "Lucho" Gómez', aula: '4.º A', tutor: 'Juan' },
        { fila: 4, estado: 'error', mensajes: ['Falta el teléfono del tutor.'], accion: '', matricula: 'A-3', estudiante: 'Eva Díaz', aula: '', tutor: 'Marta' },
      ],
    };
    const csv = csvDeProblemas(informe);
    expect(csv.startsWith('\ufeff"Fila"')).toBe(true);
    const lineas = csv.split('\r\n');
    expect(lineas).toHaveLength(3);
    expect(lineas[1]).toContain('"Luis ""Lucho"" Gómez"');
    expect(lineas[2]).toContain('Error (se omite)');
    expect(csv).not.toContain('Ana Pérez');
  });
});
