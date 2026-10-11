// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Pantalla de importación con un lector de Excel y un Supabase simulados.
const mock = vi.hoisted(() => ({ rpc: vi.fn(), leer: vi.fn() }));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ order: () => ({ range: () => Promise.resolve({ data: [], error: null }) }) }) }),
    rpc: (...a: unknown[]) => mock.rpc(...a),
  },
}));
vi.mock('./leerExcel', () => ({ leerArchivoExcel: (...a: unknown[]) => mock.leer(...a) }));

import Importar from './Importar';
import type { InformeImportacion } from './importacion';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const TITULOS = ['Matrícula', 'Nombres', 'Apellidos', 'Fecha de nacimiento', 'Grado', 'Sección', 'Especialidad', 'Nombre del tutor', 'Parentesco', 'Teléfono del tutor', 'Correo del tutor'];
const MATRIZ = [
  TITULOS,
  ['A-1', 'Ana', 'Pérez', null, '4.º', 'A', 'Informática', 'Rosa Santos', 'Madre', '809-555-1111', null],
  ['A-2', 'Luis', 'Gómez', null, '4.º', 'A', 'Informática', 'Juan Gómez', 'Padre', '555-12', null],
  ['A-3', 'Eva', 'Díaz', null, '4.º', 'A', 'Informática', 'Marta Díaz', 'Madre', '809-555-3333', 'mal'],
];
const INFORME: InformeImportacion = {
  simulacion: true, total: 3, ok: 1, advertencias: 1, errores: 1, importados: 2, tutores_nuevos: 2, tutores_reutilizados: 0,
  filas: [
    { fila: 2, estado: 'ok', mensajes: [], accion: 'tutor nuevo', matricula: 'A-1', estudiante: 'Ana Pérez', aula: '4.º A, Informática', tutor: 'Rosa Santos' },
    { fila: 3, estado: 'error', mensajes: ['El teléfono del tutor debe tener 10 dígitos.'], accion: '', matricula: 'A-2', estudiante: 'Luis Gómez', aula: '4.º A, Informática', tutor: 'Juan Gómez' },
    { fila: 4, estado: 'advertencia', mensajes: ['El correo del tutor no parece válido: se ignora.'], accion: 'tutor nuevo', matricula: 'A-3', estudiante: 'Eva Díaz', aula: '4.º A, Informática', tutor: 'Marta Díaz' },
  ],
};

const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const porTexto = (sel: string, t: string, el: ParentNode = document) => q(sel, el).find((e) => e.textContent?.includes(t)) as HTMLElement | undefined;
const esperar = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };

async function montar() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Importar />); });
  return el;
}
async function elegirArchivo(el: HTMLElement, nombre = 'estudiantes.xlsx') {
  const input = q('input[type=file]', el)[0] as HTMLInputElement;
  const archivo = new File(['x'], nombre);
  Object.defineProperty(input, 'files', { value: [archivo], configurable: true });
  await act(async () => { input.dispatchEvent(new window.Event('change', { bubbles: true })); });
  await esperar();
}

beforeEach(() => {
  mock.rpc.mockReset().mockImplementation((_n: string, args: { p_simular: boolean }) =>
    Promise.resolve({ data: args.p_simular ? INFORME : { ...INFORME, simulacion: false }, error: null }));
  mock.leer.mockReset().mockResolvedValue(MATRIZ);
});
afterEach(() => { document.body.innerHTML = ''; });

describe('Importar estudiantes desde Excel', () => {
  it('ofrece la plantilla y no llama a la base de datos hasta elegir un archivo', async () => {
    const el = await montar();
    expect(q('a[href="/plantilla_importacion_estudiantes.xlsx"]', el)).toHaveLength(1);
    expect(el.textContent).toContain('Matrícula, Nombres, Apellidos, Grado, Sección, Nombre del tutor, Teléfono del tutor');
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('revisa el archivo (sin guardar) y muestra el resumen y las filas con problemas', async () => {
    const el = await montar();
    await elegirArchivo(el);
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    const [nombre, args] = mock.rpc.mock.calls[0];
    expect(nombre).toBe('importar_estudiantes');
    expect(args.p_simular).toBe(true);
    expect(args.p_filas).toHaveLength(3);
    expect(args.p_filas[0]).toMatchObject({ fila: 2, matricula: 'A-1', tutor_telefono: '809-555-1111' });
    expect(el.textContent).toContain('Se registrarían 2 estudiantes');
    expect(el.textContent).toContain('El teléfono del tutor debe tener 10 dígitos.');
    expect(el.textContent).toContain('El correo del tutor no parece válido');
    expect(el.textContent).not.toContain('Ana Pérez'); // la fila lista se oculta mientras "solo problemas" está activo
    await click(q('input[type=checkbox]', el)[0]);
    expect(el.textContent).toContain('Ana Pérez');
  });

  it('confirma y guarda las filas válidas', async () => {
    const el = await montar();
    await elegirArchivo(el);
    await click(porTexto('button', 'Importar 2 estudiantes', el));
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Se registrarán 2 estudiantes');
    expect(mock.rpc).toHaveBeenCalledTimes(1); // todavía no se guardó
    await click(q('[role=dialog] button').find((b) => b.textContent === 'Importar 2'));
    await esperar();
    expect(mock.rpc).toHaveBeenCalledTimes(2);
    expect(mock.rpc.mock.calls[1][1].p_simular).toBe(false);
    expect(el.textContent).toContain('Importación terminada: 2 estudiantes registrados');
  });

  it('explica qué columnas faltan y no llama a la base de datos', async () => {
    mock.leer.mockResolvedValue([['Matrícula', 'Nombres'], ['A-1', 'Ana']]);
    const el = await montar();
    await elegirArchivo(el);
    expect(el.textContent).toContain('Faltan estas columnas');
    expect(el.textContent).toContain('"Teléfono del tutor"');
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it('muestra el error cuando el archivo no se puede leer', async () => {
    mock.leer.mockRejectedValue(new Error('El archivo debe ser de Excel (.xlsx).'));
    const el = await montar();
    await elegirArchivo(el, 'datos.csv');
    expect(el.textContent).toContain('El archivo debe ser de Excel (.xlsx).');
  });

  it('muestra el error de la base de datos al revisar', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'No hay un año escolar actual configurado.' } });
    const el = await montar();
    await elegirArchivo(el);
    expect(el.textContent).toContain('No hay un año escolar actual configurado.');
  });

  it('no deja importar si ninguna fila es válida', async () => {
    mock.rpc.mockResolvedValue({ data: { ...INFORME, ok: 0, advertencias: 0, errores: 3, importados: 0, tutores_nuevos: 0, filas: INFORME.filas.map((f) => ({ ...f, estado: 'error' })) }, error: null });
    const el = await montar();
    await elegirArchivo(el);
    expect((porTexto('button', 'Importar 0 estudiantes', el) as HTMLButtonElement).disabled).toBe(true);
  });
});
