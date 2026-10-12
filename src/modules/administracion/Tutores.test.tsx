// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), datos: {} as Record<string, unknown[]> }));

vi.mock('../../lib/supabase', () => {
  const qb = (tabla: string) => {
    const o: Record<string, unknown> = {
      select: () => o, eq: () => o, order: () => o, range: () => o,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: mock.datos[tabla] ?? [], error: null }).then(res, rej),
    };
    return o;
  };
  return { supabase: { from: qb, rpc: (...a: unknown[]) => mock.rpc(...a) } };
});

import Administracion from './index';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const hijo = (id: string, nombres: string, apellidos: string, activo = true) => ({ estudiantes: { id, nombres, apellidos, matricula: `M-${id}`, activo } });

function datos() {
  return {
    estudiantes: [],
    tutores: [
      { id: 't1', nombre: 'Rosa Santos', parentesco: 'Madre', telefono: '809-555-0001', correo: 'rosa@correo.test', activo: true, estudiante_tutor: [hijo('e1', 'Ana', 'Uno'), hijo('e2', 'Luis', 'Uno')] },
      { id: 't2', nombre: 'Juan Pérez', parentesco: 'Padre', telefono: '809-555-0002', correo: null, activo: true, estudiante_tutor: [hijo('e3', 'Carla', 'Tres')] },
      { id: 't3', nombre: 'Marta Díaz', parentesco: null, telefono: null, correo: null, activo: true, estudiante_tutor: [hijo('e4', 'Dani', 'Cuatro', false)] },
      { id: 't4', nombre: 'Pedro Ruiz', parentesco: 'Tío', telefono: '829-555-0004', correo: null, activo: true, estudiante_tutor: [] },
    ],
    consentimientos: [
      { tutor_id: 't1', otorgado: true, verificado: true, otorgado_en: '2026-08-15T12:00:00Z', evidencia: 'Formulario firmado' },
      { tutor_id: 't2', otorgado: true, verificado: false, otorgado_en: '2026-08-20T12:00:00Z', evidencia: 'Llamada' },
      { tutor_id: 't4', otorgado: false, verificado: false, otorgado_en: null, evidencia: null },
    ],
  };
}

const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const porTexto = (sel: string, t: string, el: ParentNode = document) => q(sel, el).find((e) => e.textContent?.includes(t)) as HTMLElement | undefined;
const esperar = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
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

async function abrir() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Administracion />); });
  await esperar();
  await click(porTexto('[role=tab]', 'Tutores', el));
  await esperar();
  return el;
}

beforeEach(() => { mock.datos = datos(); mock.rpc.mockReset().mockResolvedValue({ data: null, error: null }); });
afterEach(() => { document.body.innerHTML = ''; });

describe('Tutores', () => {
  it('lista a los tutores con sus hijos y el estado de WhatsApp', async () => {
    const el = await abrir();
    const fila = (t: string) => porTexto('tr', t, el)!.textContent ?? '';
    expect(fila('Rosa Santos')).toContain('Ana Uno');
    expect(fila('Rosa Santos')).toContain('Luis Uno');
    expect(fila('Rosa Santos')).toContain('Otorgado y verificado');
    expect(fila('Juan Pérez')).toContain('Otorgado, sin verificar');
    expect(fila('Marta Díaz')).toContain('Sin teléfono');
    expect(fila('Pedro Ruiz')).toContain('Consentimiento pendiente');
    expect(fila('Pedro Ruiz')).toContain('Sin hijos');
  });

  it('cuenta y filtra por estado', async () => {
    const el = await abrir();
    expect(el.textContent).toContain('Todos (4)');
    expect(el.textContent).toContain('Pendientes (1)');
    expect(el.textContent).toContain('Sin verificar (1)');
    expect(el.textContent).toContain('Verificados (1)');
    expect(el.textContent).toContain('Sin teléfono (1)');
    await click(porTexto('button', 'Pendientes', el));
    expect(el.textContent).toContain('Pedro Ruiz');
    expect(el.textContent).not.toContain('Rosa Santos');
  });

  it('busca por tutor, teléfono o nombre de un hijo, sin importar tildes', async () => {
    const el = await abrir();
    await escribir(q('input[placeholder^="Tutor"]', el)[0], 'PEREZ');
    expect(el.textContent).toContain('Juan Pérez');
    expect(el.textContent).not.toContain('Rosa Santos');
    await escribir(q('input[placeholder^="Tutor"]', el)[0], 'luis uno');
    expect(el.textContent).toContain('Rosa Santos');
    expect(el.textContent).not.toContain('Juan Pérez');
  });

  it('edita un tutor y normaliza el teléfono', async () => {
    const el = await abrir();
    await click(q('button[aria-label="Editar a Juan Pérez"]', el)[0]);
    await escribir(campo('Teléfono'), '(849) 555 7788');
    await escribir(campo('Parentesco'), 'Tío');
    await click(botonDialogo('Guardar cambios'));
    await esperar();
    expect(mock.rpc).toHaveBeenCalledWith('actualizar_tutor', { p_id: 't2', p_nombre: 'Juan Pérez', p_parentesco: 'Tío', p_telefono: '849-555-7788', p_correo: null });
    expect(el.textContent).toContain('Los datos de Juan Pérez fueron actualizados');
  });

  it('no guarda un teléfono inválido y avisa si el tutor tiene varios hijos', async () => {
    const el = await abrir();
    await click(q('button[aria-label="Editar a Rosa Santos"]', el)[0]);
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('tiene 2 hijos');
    await escribir(campo('Teléfono'), '555-12');
    await click(botonDialogo('Guardar cambios'));
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('El teléfono debe tener 10 dígitos');
  });

  it('el consentimiento exige evidencia y la verificación exige el consentimiento', async () => {
    const el = await abrir();
    await click(q('button[aria-label="Consentimiento de Pedro Ruiz"]', el)[0]);
    const [otorgado, verificado] = q('[role=dialog] input[type=checkbox]') as HTMLInputElement[];
    expect(verificado.disabled).toBe(true);
    await click(otorgado);
    expect(verificado.disabled).toBe(false);
    await click(botonDialogo('Guardar'));
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Escribe la evidencia');
    await escribir(campo('Evidencia'), 'Formulario firmado en la matrícula');
    await click(verificado);
    await click(botonDialogo('Guardar'));
    await esperar();
    expect(mock.rpc).toHaveBeenCalledWith('registrar_consentimiento', { p_tutor_id: 't4', p_otorgado: true, p_verificado: true, p_evidencia: 'Formulario firmado en la matrícula', p_canal: 'whatsapp' });
    expect(el.textContent).toContain('Se registró el consentimiento de WhatsApp de Pedro Ruiz');
  });

  it('retirar el consentimiento limpia la verificación', async () => {
    const el = await abrir();
    await click(q('button[aria-label="Consentimiento de Rosa Santos"]', el)[0]);
    const [otorgado] = q('[role=dialog] input[type=checkbox]') as HTMLInputElement[];
    expect(otorgado.checked).toBe(true);
    await click(otorgado);
    await escribir(campo('Nota'), 'Pidió dejar de recibir mensajes');
    await click(botonDialogo('Guardar'));
    await esperar();
    expect(mock.rpc).toHaveBeenCalledWith('registrar_consentimiento', { p_tutor_id: 't1', p_otorgado: false, p_verificado: false, p_evidencia: 'Pidió dejar de recibir mensajes', p_canal: 'whatsapp' });
  });

  it('muestra el error de la base de datos', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'x' } });
    const el = await abrir();
    await click(q('button[aria-label="Editar a Juan Pérez"]', el)[0]);
    await click(botonDialogo('Guardar cambios'));
    await esperar();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('No tienes permiso para hacer esto.');
  });

  it('explica cuándo no hay tutores', async () => {
    mock.datos.tutores = [];
    const el = await abrir();
    expect(el.textContent).toContain('Todavía no hay tutores');
  });
});
