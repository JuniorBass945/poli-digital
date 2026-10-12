// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), rol: 'coordinacion', datos: {} as Record<string, unknown[]> }));

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
vi.mock('../../auth/AuthProvider', () => ({
  useAuth: () => ({ perfil: { id: 'u1', centroId: 'c1', centroNombre: 'Centro', rol: mock.rol, nombre: 'Usuario' } }),
}));

import Asistencia from './index';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const PANEL = {
  desde: '2026-09-11', hasta: '2026-10-10', umbral: 3, hoy: '2026-10-10',
  resumen: { total: 400, presentes: 360, ausentes: 20, tardanzas: 12, excusas: 8, pct_asistencia: 93, listas: 30, estudiantes: 40, dias_con_lista: 15 },
  por_dia: [
    { fecha: '2026-10-08', total: 200, presentes: 190, ausentes: 6, tardanzas: 2, excusas: 2, pct: 96 },
    { fecha: '2026-10-09', total: 200, presentes: 160, ausentes: 30, tardanzas: 5, excusas: 5, pct: 82.5 },
  ],
  por_aula: [
    { aula_id: 'a1', aula: '4.º A, Informática', listas: 15, total: 200, presentes: 190, ausentes: 6, tardanzas: 2, excusas: 2, pct: 96 },
    { aula_id: 'a2', aula: '4.º B, Electricidad', listas: 15, total: 200, presentes: 160, ausentes: 30, tardanzas: 5, excusas: 5, pct: 78 },
  ],
  en_riesgo: [
    { estudiante_id: 'e1', nombre: 'Rosario, Starlin', matricula: 'P26-1', dias_ausente: 7, tardanzas: 2, ultima_ausencia: '2026-10-09', aula: '4.º B, Electricidad' },
  ],
  sin_lista_hoy: [{ asignacion_id: 's1', aula: '4.º A, Informática', materia: 'Lengua', docente: 'Prof. Carmen Peña' }],
};

const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const porTexto = (sel: string, t: string, el: ParentNode = document) => q(sel, el).find((e) => e.textContent?.includes(t)) as HTMLElement | undefined;
const esperar = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const elegir = async (n: Element, v: string) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')!.set!;
  await act(async () => { set.call(n, v); n.dispatchEvent(new window.Event('change', { bubbles: true })); });
};
const campo = (etiqueta: string, el: ParentNode = document) => q('label', el).find((l) => l.textContent?.includes(etiqueta))!.querySelector('select,input')!;

async function montar() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Asistencia />); });
  await esperar();
  return el;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0));
  mock.rol = 'coordinacion';
  mock.datos = { aulas: [{ id: 'a1', grado: '4.º', seccion: 'A', especialidad: 'Informática' }, { id: 'a2', grado: '4.º', seccion: 'B', especialidad: 'Electricidad' }] };
  mock.rpc.mockReset().mockResolvedValue({ data: PANEL, error: null });
});
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('Resumen de asistencia', () => {
  it('dirección solo ve el resumen (no pasa lista) y carga los últimos 30 días', async () => {
    mock.rol = 'direccion';
    const el = await montar();
    expect(q('[role=tab]', el)).toHaveLength(0);
    expect(mock.rpc).toHaveBeenCalledWith('panel_asistencia', { p_desde: '2026-09-11', p_hasta: '2026-10-10', p_aula_id: null, p_umbral: 3 });
    expect(el.textContent).toContain('93%');
    expect(el.textContent).toContain('Cómo va la asistencia del centro');
  });

  it('coordinación y docentes ven las dos pestañas', async () => {
    for (const rol of ['coordinacion', 'docente']) {
      mock.rol = rol;
      document.body.innerHTML = '';
      const el = await montar();
      expect(q('[role=tab]', el).map((t) => t.textContent)).toEqual(['Pasar lista', 'Resumen']);
    }
  });

  it('muestra indicadores, aulas de menor a mayor asistencia, riesgo y clases sin lista hoy', async () => {
    const el = await montar();
    await click(porTexto('[role=tab]', 'Resumen', el));
    await esperar();
    expect(el.textContent).toContain('Listas pasadas');
    const filas = q('tbody tr', el).map((f) => f.textContent ?? '');
    expect(filas[0]).toContain('4.º B, Electricidad');   // la peor, primero
    expect(filas[0]).toContain('78%');
    expect(filas[1]).toContain('4.º A, Informática');
    expect(el.textContent).toContain('Estudiantes en riesgo (1)');
    expect(el.textContent).toContain('Rosario, Starlin');
    expect(el.textContent).toContain('09/10/2026');
    expect(el.textContent).toContain('Clases que hoy no han pasado lista (1)');
    expect(el.textContent).toContain('Prof. Carmen Peña');
    expect(q('[role=img][aria-label="Gráfico de asistencia por día"] > div', el)).toHaveLength(2);
  });

  it('cambiar el período, el aula o el umbral vuelve a consultar', async () => {
    mock.rol = 'direccion';
    const el = await montar();
    mock.rpc.mockClear();
    await elegir(campo('Período', el), '7');
    expect(mock.rpc).toHaveBeenLastCalledWith('panel_asistencia', { p_desde: '2026-10-04', p_hasta: '2026-10-10', p_aula_id: null, p_umbral: 3 });
    await elegir(campo('Aula', el), 'a2');
    expect(mock.rpc).toHaveBeenLastCalledWith('panel_asistencia', { p_desde: '2026-10-04', p_hasta: '2026-10-10', p_aula_id: 'a2', p_umbral: 3 });
    await elegir(campo('Riesgo desde', el), '5');
    expect(mock.rpc).toHaveBeenLastCalledWith('panel_asistencia', { p_desde: '2026-10-04', p_hasta: '2026-10-10', p_aula_id: 'a2', p_umbral: 5 });
    await elegir(campo('Período', el), 'mes');
    expect(mock.rpc).toHaveBeenLastCalledWith('panel_asistencia', { p_desde: '2026-10-01', p_hasta: '2026-10-10', p_aula_id: 'a2', p_umbral: 5 });
  });

  it('elegir fechas muestra los campos Desde y Hasta', async () => {
    mock.rol = 'direccion';
    const el = await montar();
    expect(porTexto('label', 'Desde', el)).toBeUndefined();
    await elegir(campo('Período', el), 'otro');
    expect(campo('Desde', el)).toBeDefined();
    expect(campo('Hasta', el)).toBeDefined();
  });

  it('explica cuándo no hay asistencia en el período', async () => {
    mock.rol = 'direccion';
    mock.rpc.mockResolvedValue({ data: { ...PANEL, resumen: { ...PANEL.resumen, total: 0, pct_asistencia: null }, por_dia: [], por_aula: [], en_riesgo: [], sin_lista_hoy: [] }, error: null });
    const el = await montar();
    expect(el.textContent).toContain('No hay asistencia registrada en este período');
  });

  it('un docente no ve el filtro de aula', async () => {
    mock.rol = 'docente';
    mock.datos.asignaciones = [];
    const el = await montar();
    await click(porTexto('[role=tab]', 'Resumen', el));
    await esperar();
    expect(porTexto('label', 'Aula', el)).toBeUndefined();
  });

  it('muestra el error de la base de datos', async () => {
    mock.rol = 'direccion';
    mock.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'El rango no puede pasar de un año.' } });
    const el = await montar();
    expect(el.textContent).toContain('El rango no puede pasar de un año.');
  });
});
