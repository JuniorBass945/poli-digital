// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), rol: 'docente', datos: [] as unknown[] }));

vi.mock('../../lib/supabase', () => {
  const qb = () => {
    const o: Record<string, unknown> = {
      select: () => o, order: () => o, range: () => o,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: mock.datos, error: null }).then(res, rej),
    };
    return o;
  };
  return { supabase: { from: qb, rpc: (...a: unknown[]) => mock.rpc(...a) } };
});
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ perfil: { id: 'u1', centroId: 'c1', centroNombre: 'Centro', rol: mock.rol, nombre: 'Prof. Prueba' } }),
}));

import Avisos from './index';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const aviso = (id: string, estado: string, nombres: string, apellidos: string, telefono: string | null, extra: Record<string, unknown> = {}) => ({
  id, fecha: '2026-10-09', estado, texto: `Buenas, Tutor de ${nombres}. ${nombres} ${apellidos} no asistió hoy a la clase de Matemática (4.º A).`, nota: null, gestionado_en: null,
  estudiantes: { nombres, apellidos, matricula: `M-${id}` },
  tutores: { nombre: `Tutor de ${nombres}`, parentesco: 'Madre', telefono },
  ...extra,
});

const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const porTexto = (sel: string, t: string, el: ParentNode = document) => q(sel, el).find((e) => e.textContent?.includes(t)) as HTMLElement | undefined;
const esperar = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true })); }); };
const escribir = async (n: Element, v: string) => {
  const proto = n instanceof window.HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  await act(async () => { set.call(n, v); n.dispatchEvent(new window.Event('input', { bubbles: true })); });
};

async function montar() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Avisos />); });
  await esperar();
  return el;
}

const sinNavegar = (e: Event) => e.preventDefault();

beforeEach(() => {
  mock.rol = 'docente';
  mock.datos = [
    aviso('1', 'pendiente', 'Ana', 'Uno', '809-555-0001'),
    aviso('2', 'pendiente', 'Beto', 'Dos', null),
    aviso('3', 'enviado', 'Carla', 'Tres', '809-555-0003'),
    aviso('4', 'omitido', 'Dani', 'Cuatro', '809-555-0004', { nota: 'Ya hablé con la familia' }),
    aviso('5', 'cancelado', 'Eva', 'Cinco', '809-555-0005'),
  ];
  mock.rpc.mockReset().mockResolvedValue({ data: null, error: null });
  document.addEventListener('click', sinNavegar, true); // jsdom no navega a wa.me
});
afterEach(() => { document.removeEventListener('click', sinNavegar, true); document.body.innerHTML = ''; });

describe('Avisos a tutores', () => {
  it('muestra los pendientes por defecto, con los conteos de cada estado', async () => {
    const el = await montar();
    expect(el.textContent).toContain('Pendientes (2)');
    expect(el.textContent).toContain('Enviados (1)');
    expect(el.textContent).toContain('Omitidos (1)');
    expect(el.textContent).toContain('Cancelados (1)');
    expect(el.textContent).toContain('Todos (5)');
    expect(el.textContent).toContain('Uno, Ana');
    expect(el.textContent).toContain('Dos, Beto');
    expect(el.textContent).not.toContain('Tres, Carla');
    expect(el.textContent).toContain('Ausencia del 09/10/2026');
  });

  it('el enlace de WhatsApp lleva el número y el mensaje, y marca el aviso como enviado', async () => {
    const el = await montar();
    const enlace = q('a', el).find((a) => a.textContent?.includes('Enviar por WhatsApp')) as HTMLAnchorElement;
    expect(enlace.href).toBe('https://wa.me/18095550001?text=' + encodeURIComponent('Buenas, Tutor de Ana. Ana Uno no asistió hoy a la clase de Matemática (4.º A).'));
    expect(enlace.target).toBe('_blank');
    expect(enlace.rel).toContain('noopener');
    await click(enlace);
    await esperar();
    expect(mock.rpc).toHaveBeenCalledWith('gestionar_aviso', { p_id: '1', p_estado: 'enviado', p_nota: null });
    expect(el.textContent).toContain('el aviso quedó como enviado');
  });

  it('sin teléfono no se puede enviar y se indica', async () => {
    const el = await montar();
    expect(el.textContent).toContain('Sin teléfono');
    const botones = q('button', el).filter((b) => b.textContent?.includes('Enviar por WhatsApp')) as HTMLButtonElement[];
    expect(botones).toHaveLength(1);
    expect(botones[0].disabled).toBe(true);
  });

  it('omite un aviso con una nota', async () => {
    const el = await montar();
    await click(q('button', el).find((b) => b.textContent?.includes('Omitir')));
    await escribir(q('[role=dialog] textarea')[0], 'Ya hablé con la familia');
    await click(q('[role=dialog] button').find((b) => b.textContent === 'Omitir aviso'));
    await esperar();
    expect(mock.rpc).toHaveBeenCalledWith('gestionar_aviso', { p_id: '1', p_estado: 'omitido', p_nota: 'Ya hablé con la familia' });
  });

  it('un aviso enviado se puede devolver a pendiente', async () => {
    const el = await montar();
    await click(porTexto('[role=tab]', 'Enviados', el));
    expect(el.textContent).toContain('Tres, Carla');
    await click(porTexto('button', 'Volver a pendiente', el));
    await esperar();
    expect(mock.rpc).toHaveBeenCalledWith('gestionar_aviso', { p_id: '3', p_estado: 'pendiente', p_nota: null });
  });

  it('muestra la nota de los omitidos y explica los cancelados', async () => {
    const el = await montar();
    await click(porTexto('[role=tab]', 'Omitidos', el));
    expect(el.textContent).toContain('Nota: Ya hablé con la familia');
    await click(porTexto('[role=tab]', 'Cancelados', el));
    expect(el.textContent).toContain('ya no figura ausente');
    expect(porTexto('button', 'Volver a pendiente', el)).toBeUndefined();
  });

  it('busca por estudiante o tutor sin importar tildes', async () => {
    const el = await montar();
    await click(porTexto('[role=tab]', 'Todos', el));
    await escribir(q('input[placeholder^="Estudiante"]', el)[0], 'TUTOR DE CARLA');
    expect(el.textContent).toContain('Tres, Carla');
    expect(el.textContent).not.toContain('Uno, Ana');
  });

  it('orientación y dirección solo consultan: no ven botones de envío', async () => {
    mock.rol = 'orientacion';
    const el = await montar();
    expect(el.textContent).toContain('Uno, Ana');
    expect(porTexto('button', 'Omitir', el)).toBeUndefined();
    expect(q('a', el).filter((a) => a.textContent?.includes('Enviar por WhatsApp'))).toHaveLength(0);
  });

  it('muestra el error cuando la base de datos rechaza el cambio', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'x' } });
    const el = await montar();
    await click(q('button', el).find((b) => b.textContent?.includes('Omitir')));
    await click(q('[role=dialog] button').find((b) => b.textContent === 'Omitir aviso'));
    await esperar();
    expect(el.textContent).toContain('No tienes permiso para gestionar este aviso.');
  });

  describe('envío seguido', () => {
    beforeEach(() => {
      mock.datos = [
        aviso('1', 'pendiente', 'Ana', 'Uno', '809-555-0001'),
        aviso('2', 'pendiente', 'Beto', 'Dos', null),
        aviso('6', 'pendiente', 'Fran', 'Seis', '829-555-0006'),
        aviso('3', 'enviado', 'Carla', 'Tres', '809-555-0003'),
      ];
    });

    it('ofrece enviar todos los pendientes que tienen teléfono', async () => {
      const el = await montar();
      expect(porTexto('button', 'Enviar todos los pendientes (2)', el)).toBeDefined(); // Beto no tiene teléfono
    });

    it('recorre los avisos uno tras otro, marcando cada uno como enviado', async () => {
      const el = await montar();
      await click(porTexto('button', 'Enviar todos los pendientes', el));
      const dialogo = () => document.querySelector('[role=dialog]')!;
      expect(dialogo().textContent).toContain('Aviso 1 de 2');
      expect(dialogo().textContent).toContain('Uno, Ana');
      const abrir = () => q('[role=dialog] a').find((a) => a.textContent?.includes('Abrir WhatsApp')) as HTMLAnchorElement;
      expect(abrir().href).toContain('https://wa.me/18095550001?text=');
      expect(abrir().target).toBe('_blank');
      await click(abrir());
      await esperar();
      expect(mock.rpc).toHaveBeenCalledWith('gestionar_aviso', { p_id: '1', p_estado: 'enviado', p_nota: null });
      expect(dialogo().textContent).toContain('Aviso 2 de 2');
      expect(dialogo().textContent).toContain('Seis, Fran');
      expect(abrir().href).toContain('https://wa.me/18295550006?text=');
      await click(porTexto('button', 'Saltar este aviso', dialogo() as HTMLElement));
      expect(dialogo().textContent).toContain('1 aviso marcado como enviado y 1 saltado (siguen pendientes)');
      expect(mock.rpc).toHaveBeenCalledTimes(1);
      await click(porTexto('button', 'Cerrar', dialogo() as HTMLElement));
      expect(document.querySelector('[role=dialog]')).toBeNull();
    });

    it('si falla el envío de un aviso, se queda en ese y muestra el error', async () => {
      mock.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Este aviso fue cancelado porque el estudiante ya no figura ausente.' } });
      const el = await montar();
      await click(porTexto('button', 'Enviar todos los pendientes', el));
      await click(q('[role=dialog] a').find((a) => a.textContent?.includes('Abrir WhatsApp')));
      await esperar();
      expect(document.querySelector('[role=dialog]')?.textContent).toContain('Aviso 1 de 2');
      expect(document.querySelector('[role=dialog]')?.textContent).toContain('ya no figura ausente');
    });

    it('orientación no ve la opción de envío seguido', async () => {
      mock.rol = 'orientacion';
      const el = await montar();
      expect(porTexto('button', 'Enviar todos los pendientes', el)).toBeUndefined();
    });

    it('no aparece si ningún pendiente tiene teléfono', async () => {
      mock.datos = [aviso('2', 'pendiente', 'Beto', 'Dos', null)];
      const el = await montar();
      expect(porTexto('button', 'Enviar todos los pendientes', el)).toBeUndefined();
    });
  });

  it('explica cuándo no hay avisos', async () => {
    mock.datos = [];
    const el = await montar();
    expect(el.textContent).toContain('Todavía no hay avisos');
  });
});
