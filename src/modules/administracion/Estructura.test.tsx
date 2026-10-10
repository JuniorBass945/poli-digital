// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Pruebas de docentes, materias, aulas y asignaciones con un Supabase simulado.
const mock = vi.hoisted(() => ({ rpc: vi.fn() }));

const DATOS: Record<string, unknown[]> = {
  estudiantes: [],
  tutores: [],
  anios_escolares: [{ nombre: '2026-2027' }],
  docentes: [
    { id: 'd1', nombre: 'Prof. Carmen Peña', correo: 'carmen@centro.test', activo: true, baja_motivo: null, baja_nota: null, perfil_id: null },
    { id: 'd2', nombre: 'Ing. Kelvin Disla', correo: null, activo: true, baja_motivo: null, baja_nota: null, perfil_id: null },
    { id: 'd3', nombre: 'Prof. Luis Almonte', correo: null, activo: false, baja_motivo: 'renuncia', baja_nota: null, perfil_id: null },
  ],
  materias: [
    { id: 'm1', nombre: 'Lengua Española', codigo: 'LEN', activo: true },
    { id: 'm2', nombre: 'Matemática', codigo: null, activo: true },
    { id: 'm3', nombre: 'Física', codigo: null, activo: true },
    { id: 'm4', nombre: 'Materia vieja', codigo: null, activo: false },
  ],
  aulas: [
    { id: 'a1', grado: '4.º', seccion: 'A', especialidad: 'Informática', guia_id: 'd1', activo: true },
    { id: 'a2', grado: '4.º', seccion: 'B', especialidad: null, guia_id: null, activo: true },
  ],
  asignaciones: [
    { id: 's1', aula_id: 'a1', materia_id: 'm1', docente_id: 'd1' },
    { id: 's2', aula_id: 'a1', materia_id: 'm2', docente_id: 'd1' },
    { id: 's3', aula_id: 'a2', materia_id: 'm1', docente_id: 'd1' },
  ],
};

vi.mock('../../lib/supabase', () => {
  const qb = (tabla: string) => {
    const o: Record<string, unknown> = {
      select: () => o, eq: () => o, order: () => o, range: () => o,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: DATOS[tabla] ?? [], error: null }).then(res, rej),
    };
    return o;
  };
  return {
    supabase: {
      from: qb,
      rpc: (nombre: string, args: unknown) => {
        if (nombre === 'resumen_estudiantes_por_aula') return Promise.resolve({ data: [{ aula_id: 'a1', activos: 12 }], error: null });
        return mock.rpc(nombre, args);
      },
    },
  };
});

import Administracion from './index';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const porTexto = (sel: string, t: string, el: ParentNode = document) => q(sel, el).find((e) => e.textContent?.includes(t)) as HTMLElement | undefined;
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const esperar = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const escribir = async (n: Element, v: string) => {
  const proto = n instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : n instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  await act(async () => { set.call(n, v); n.dispatchEvent(new window.Event(n instanceof window.HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
};
const campo = (etiqueta: string) => {
  const raiz = document.querySelector('[role=dialog]') ?? document;
  const l = q('label', raiz).find((e) => e.textContent?.includes(etiqueta));
  if (!l) throw new Error(`no se encontró el campo "${etiqueta}"`);
  return l.querySelector('input,select,textarea')!;
};
const botonDialogo = (texto: string) => q('[role=dialog] button').find((b) => b.textContent === texto) as HTMLButtonElement;

async function abrir(pestana: string) {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Administracion />); });
  await esperar();
  await click(porTexto('[role=tab]', pestana, el));
  await esperar();
  return el;
}

beforeEach(() => { mock.rpc.mockReset().mockResolvedValue({ data: 'id', error: null }); });
afterEach(() => { document.body.innerHTML = ''; });

describe('Docentes', () => {
  it('muestra los activos con sus clases y su aula guía, y oculta las bajas', async () => {
    const el = await abrir('Docentes');
    expect(el.textContent).toContain('Prof. Carmen Peña');
    expect(el.textContent).toContain('3 materias en 2 aulas');
    expect(el.textContent).toContain('4.º A, Informática');
    expect(el.textContent).toContain('Ing. Kelvin Disla');
    expect(el.textContent).toContain('Sin clases');
    expect(el.textContent).not.toContain('Prof. Luis Almonte');
    await click(q('input[type=checkbox]', el)[0]);
    expect(el.textContent).toContain('Prof. Luis Almonte');
    expect(el.textContent).toContain('Baja: Renuncia');
  });

  it('registra un docente', async () => {
    await abrir('Docentes');
    await click(porTexto('button', 'Nuevo docente'));
    await escribir(campo('Nombre con título'), 'Prof. Ana Ruiz');
    await escribir(campo('Correo'), 'ana@centro.test');
    await click(botonDialogo('Registrar docente'));
    expect(mock.rpc).toHaveBeenCalledWith('crear_docente', { p_nombre: 'Prof. Ana Ruiz', p_correo: 'ana@centro.test' });
  });

  it('no deja dar de baja a un docente con clases y explica por qué', async () => {
    await abrir('Docentes');
    await click(q('button[aria-label="Dar de baja a Prof. Carmen Peña"]')[0]);
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Tiene 3 materia(s) asignada(s) y es guía de 1 aula(s)');
    await escribir(campo('Motivo de la baja'), 'renuncia');
    expect(botonDialogo('Dar de baja').disabled).toBe(true);
  });

  it('da de baja a un docente sin clases con un motivo de la lista', async () => {
    await abrir('Docentes');
    await click(q('button[aria-label="Dar de baja a Ing. Kelvin Disla"]')[0]);
    expect(botonDialogo('Dar de baja').disabled).toBe(true);
    await escribir(campo('Motivo de la baja'), 'traslado');
    expect(botonDialogo('Dar de baja').disabled).toBe(false);
    await click(botonDialogo('Dar de baja'));
    expect(mock.rpc).toHaveBeenCalledWith('dar_baja_docente', { p_id: 'd2', p_motivo: 'traslado', p_nota: null });
  });
});

describe('Materias', () => {
  it('muestra en cuántas aulas se da cada una y oculta las archivadas', async () => {
    const el = await abrir('Materias');
    expect(porTexto('tr', 'Lengua Española', el)?.textContent).toContain('2 aulas');
    expect(porTexto('tr', 'Física', el)?.textContent).toContain('Ninguna aula');
    expect(el.textContent).not.toContain('Materia vieja');
  });

  it('no archiva una materia asignada, pero sí una sin uso', async () => {
    await abrir('Materias');
    await click(q('button[aria-label="Archivar Lengua Española"]')[0]);
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Está asignada en 2 aula(s)');
    expect(botonDialogo('Archivar').disabled).toBe(true);
    await click(q('[role=dialog] button[aria-label="Cerrar"]')[0]);
    await click(q('button[aria-label="Archivar Física"]')[0]);
    expect(botonDialogo('Archivar').disabled).toBe(false);
    await click(botonDialogo('Archivar'));
    expect(mock.rpc).toHaveBeenCalledWith('archivar_materia', { p_id: 'm3' });
  });

  it('crea una materia', async () => {
    await abrir('Materias');
    await click(porTexto('button', 'Nueva materia'));
    await escribir(campo('Nombre de la materia'), 'Química');
    await click(botonDialogo('Crear materia'));
    expect(mock.rpc).toHaveBeenCalledWith('crear_materia', { p_nombre: 'Química', p_codigo: null });
  });
});

describe('Aulas', () => {
  it('muestra el año actual, la guía y los conteos', async () => {
    const el = await abrir('Aulas');
    expect(el.textContent).toContain('2026-2027');
    const fila = porTexto('tr', '4.º A, Informática', el)!;
    expect(fila.textContent).toContain('Prof. Carmen Peña');
    expect(fila.textContent).toContain('12');
  });

  it('crea un aula con grado, sección, especialidad y guía', async () => {
    await abrir('Aulas');
    await click(porTexto('button', 'Nueva aula'));
    await click(botonDialogo('Crear aula'));
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Elige el grado.');
    await escribir(campo('Grado'), '6.º');
    await escribir(campo('Sección'), 'C');
    await escribir(campo('Especialidad'), 'Informática');
    await escribir(campo('Docente guía'), 'd2');
    await click(botonDialogo('Crear aula'));
    expect(mock.rpc).toHaveBeenCalledWith('crear_aula', { p_grado: '6.º', p_seccion: 'C', p_especialidad: 'Informática', p_guia_id: 'd2' });
  });

  it('traduce el error de un aula repetida', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "aulas_unica_idx"' } });
    await abrir('Aulas');
    await click(porTexto('button', 'Nueva aula'));
    await escribir(campo('Grado'), '4.º');
    await escribir(campo('Sección'), 'A');
    await click(botonDialogo('Crear aula'));
    expect(document.body.textContent).toContain('Ya existe un aula con ese grado, sección y especialidad');
  });

  it('no archiva un aula con estudiantes', async () => {
    await abrir('Aulas');
    await click(q('button[aria-label="Archivar 4.º A, Informática"]')[0]);
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Tiene 12 estudiante(s) activo(s)');
    expect(botonDialogo('Archivar').disabled).toBe(true);
  });
});

describe('Asignaciones', () => {
  it('muestra las materias del aula y cambia el docente de una', async () => {
    const el = await abrir('Asignaciones');
    expect(el.textContent).toContain('Lengua Española');
    expect(el.textContent).toContain('Matemática');
    expect(el.textContent).toContain('2 materias asignadas');
    await escribir(q('select[aria-label="Docente de Lengua Española"]', el)[0], 'd2');
    expect(mock.rpc).toHaveBeenCalledWith('cambiar_docente_asignacion', { p_id: 's1', p_docente_id: 'd2' });
  });

  it('agrega una materia con su docente (solo ofrece las que faltan)', async () => {
    const el = await abrir('Asignaciones');
    const materia = campo('Materia') as HTMLSelectElement;
    const opciones = [...materia.options].map((o) => o.textContent);
    expect(opciones).toContain('Física');
    expect(opciones).not.toContain('Lengua Española');
    expect(opciones).not.toContain('Materia vieja');
    const agregar = porTexto('button', 'Agregar', el) as HTMLButtonElement;
    expect(agregar.disabled).toBe(true);
    await escribir(materia, 'm3');
    await escribir(campo('Docente'), 'd2');
    await click(agregar);
    expect(mock.rpc).toHaveBeenCalledWith('asignar_materia', { p_aula_id: 'a1', p_materia_id: 'm3', p_docente_id: 'd2' });
  });

  it('quita una materia del aula tras confirmar', async () => {
    await abrir('Asignaciones');
    await click(q('button[aria-label="Quitar Lengua Española"]')[0]);
    await click(botonDialogo('Quitar'));
    expect(mock.rpc).toHaveBeenCalledWith('quitar_asignacion', { p_id: 's1' });
  });
});
