// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Prueba de la pantalla de Estudiantes con un Supabase simulado.
const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  estudiantes: [] as unknown[],
}));

vi.mock('../../lib/supabase', () => {
  const datos = (tabla: string) => {
    if (tabla === 'estudiantes') return mock.estudiantes;
    if (tabla === 'aulas')
      return [
        { id: 'a1', grado: '4.º', seccion: 'A', especialidad: 'Informática', anio_escolar_id: 'y1' },
        { id: 'a2', grado: '4.º', seccion: 'B', especialidad: 'Electricidad', anio_escolar_id: 'y1' },
      ];
    if (tabla === 'tutores') return [{ id: 't9', nombre: 'Marisol Tavárez', parentesco: 'Madre', telefono: '809-555-1000', correo: null }];
    return [];
  };
  const qb = (tabla: string) => {
    const o: Record<string, unknown> = {
      select: () => o, eq: () => o, order: () => o, range: () => o,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: datos(tabla), error: null }).then(res, rej),
    };
    return o;
  };
  return { supabase: { from: qb, rpc: (...a: unknown[]) => mock.rpc(...a) } };
});

import Administracion from './index';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fila = (id: string, matricula: string, nombres: string, apellidos: string, aula: string, tutor: string, activo = true) => ({
  id, matricula, nombres, apellidos, fecha_nacimiento: null, activo,
  baja_en: activo ? null : '2026-10-01T00:00:00Z', baja_motivo: activo ? null : 'traslado', baja_nota: null,
  matriculas: [{ aula_id: aula, estado: activo ? 'activa' : 'retirada' }],
  estudiante_tutor: [{ principal: true, tutores: { id: `t-${id}`, nombre: tutor, parentesco: 'Madre', telefono: '809-555-0000', correo: null } }],
});

async function montar() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Administracion />); });
  for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
  return el;
}
const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const porTexto = (sel: string, t: string) => q(sel).find((e) => e.textContent?.includes(t)) as HTMLElement | undefined;
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const escribir = async (n: Element, v: string) => {
  const proto = n instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : n instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  await act(async () => { set.call(n, v); n.dispatchEvent(new window.Event(n instanceof window.HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
};
// Busca el campo dentro del cuadro de diálogo abierto (hay etiquetas repetidas, como "Aula", en la página).
const campo = (etiqueta: string) => {
  const raiz = document.querySelector('[role=dialog]') ?? document;
  const l = q('label', raiz).find((e) => e.textContent?.includes(etiqueta));
  if (!l) throw new Error(`no se encontró el campo "${etiqueta}"`);
  return l.querySelector('input,select,textarea')!;
};

beforeEach(() => {
  mock.rpc.mockReset().mockResolvedValue({ data: 'nuevo-id', error: null });
  mock.estudiantes = [
    fila('e1', 'P26-1', 'Ana', 'Pérez', 'a1', 'Rosa Pérez'),
    fila('e2', 'P26-2', 'Luis', 'Martínez', 'a2', 'Juan Martínez'),
    fila('e3', 'P26-3', 'Eva', 'Núñez', 'a1', 'Marta Núñez', false),
  ];
});
afterEach(() => { document.body.innerHTML = ''; });

describe('Gestión de datos: estudiantes', () => {
  it('lista a los activos y oculta a los dados de baja hasta pedirlos', async () => {
    const el = await montar();
    expect(el.textContent).toContain('Pérez, Ana');
    expect(el.textContent).toContain('Martínez, Luis');
    expect(el.textContent).not.toContain('Núñez, Eva');
    expect(el.textContent).toContain('Activos: 2. De baja: 1.');
    await click(q('input[type=checkbox]', el)[0]);
    expect(el.textContent).toContain('Núñez, Eva');
    expect(el.textContent).toContain('Baja: Traslado a otro centro');
  });

  it('busca sin importar tildes ni mayúsculas', async () => {
    const el = await montar();
    await escribir(q('input[placeholder^="Nombre"]', el)[0], 'MARTINEZ');
    expect(el.textContent).toContain('Martínez, Luis');
    expect(el.textContent).not.toContain('Pérez, Ana');
  });

  it('registra un estudiante con tutor nuevo y normaliza el teléfono', async () => {
    const el = await montar();
    await click(porTexto('button', 'Nuevo estudiante'));
    await escribir(campo('Matrícula'), 'P26-9');
    await escribir(campo('Nombres'), 'Pedro');
    await escribir(campo('Apellidos'), 'Gómez');
    await escribir(campo('Aula'), 'a2');
    await escribir(campo('Nombre del tutor'), 'Carla Gómez');
    await escribir(campo('Teléfono (WhatsApp)'), '8295551234');
    await click(porTexto('button', 'Registrar estudiante'));
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    expect(mock.rpc.mock.calls[0][0]).toBe('crear_estudiante');
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({
      p_matricula: 'P26-9', p_nombres: 'Pedro', p_apellidos: 'Gómez', p_aula_id: 'a2',
      p_tutor_id: null, p_tutor_nombre: 'Carla Gómez', p_tutor_telefono: '829-555-1234',
    });
    expect(el.textContent).toContain('Pedro Gómez fue registrado');
  });

  it('no envía el formulario si faltan datos y muestra los errores', async () => {
    await montar();
    await click(porTexto('button', 'Nuevo estudiante'));
    await click(porTexto('button', 'Registrar estudiante'));
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Escribe la matrícula.');
    expect(document.body.textContent).toContain('Elige un aula.');
    expect(document.body.textContent).toContain('Escribe el teléfono del tutor.');
  });

  it('muestra el error del servidor, por ejemplo una matrícula repetida', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "estudiantes_centro_id_matricula_key"' } });
    await montar();
    await click(porTexto('button', 'Nuevo estudiante'));
    await escribir(campo('Matrícula'), 'P26-1');
    await escribir(campo('Nombres'), 'X');
    await escribir(campo('Apellidos'), 'Y');
    await escribir(campo('Aula'), 'a1');
    await escribir(campo('Nombre del tutor'), 'Z');
    await escribir(campo('Teléfono (WhatsApp)'), '809-555-1111');
    await click(porTexto('button', 'Registrar estudiante'));
    expect(document.body.textContent).toContain('Ya existe un estudiante con esa matrícula.');
  });

  it('da de baja con un motivo de la lista', async () => {
    const el = await montar();
    await click(q('button[aria-label="Dar de baja a Ana Pérez"]', el)[0]);
    const confirmar = porTexto('button', 'Dar de baja') as HTMLButtonElement;
    expect(q('[role=dialog] button').find((b) => b.textContent === 'Dar de baja')).toHaveProperty('disabled', true);
    await escribir(campo('Motivo de la baja'), 'traslado');
    await escribir(campo('Nota (opcional)'), 'Se muda a Santiago');
    const boton = q('[role=dialog] button').find((b) => b.textContent === 'Dar de baja') as HTMLButtonElement;
    expect(boton.disabled).toBe(false);
    await click(boton);
    expect(confirmar).toBeDefined();
    expect(mock.rpc).toHaveBeenCalledWith('dar_baja_estudiante', { p_id: 'e1', p_motivo: 'traslado', p_nota: 'Se muda a Santiago' });
    expect(el.textContent).toContain('Ana Pérez fue dado de baja');
  });

  it('el motivo "Otro" exige una nota', async () => {
    const el = await montar();
    await click(q('button[aria-label="Dar de baja a Luis Martínez"]', el)[0]);
    await escribir(campo('Motivo de la baja'), 'otro');
    const boton = () => q('[role=dialog] button').find((b) => b.textContent === 'Dar de baja') as HTMLButtonElement;
    expect(boton().disabled).toBe(true);
    await escribir(campo('Nota (obligatoria)'), 'Cambio de país');
    expect(boton().disabled).toBe(false);
  });

  it('reactiva a un estudiante dado de baja', async () => {
    const el = await montar();
    await click(q('input[type=checkbox]', el)[0]);
    await click(q('button[aria-label="Reactivar a Eva Núñez"]', el)[0]);
    await click(q('[role=dialog] button').find((b) => b.textContent === 'Reactivar'));
    expect(mock.rpc).toHaveBeenCalledWith('reactivar_estudiante', { p_id: 'e3' });
  });

  it('edita un estudiante: cambia el aula y los datos del tutor', async () => {
    const el = await montar();
    await click(q('button[aria-label="Editar a Ana Pérez"]', el)[0]);
    expect((campo('Matrícula') as HTMLInputElement).value).toBe('P26-1');
    await escribir(campo('Aula'), 'a2');
    await escribir(campo('Teléfono (WhatsApp)'), '849-555-7777');
    await click(porTexto('button', 'Guardar cambios'));
    expect(mock.rpc.mock.calls[0][0]).toBe('actualizar_estudiante');
    expect(mock.rpc.mock.calls[0][1]).toMatchObject({ p_id: 'e1', p_aula_id: 'a2', p_tutor_telefono: '849-555-7777' });
  });
});
