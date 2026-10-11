// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ rpc: vi.fn(), rol: 'docente', datos: {} as Record<string, unknown[]> }));

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
  useAuth: () => ({ perfil: { id: 'u1', centroId: 'c1', centroNombre: 'Centro', rol: mock.rol, nombre: 'Prof. Prueba' } }),
}));

import Asistencia from './index';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const est = (id: string, nombres: string, apellidos: string, matricula: string) => ({ estudiante_id: id, estudiantes: { id, nombres, apellidos, matricula } });

function datosBase() {
  return {
    asignaciones: [
      { id: 's1', aula_id: 'a1', materia_id: 'm1', docente_id: 'd1' },
      { id: 's2', aula_id: 'a1', materia_id: 'm2', docente_id: 'd1' },
    ],
    aulas: [{ id: 'a1', grado: '4.º', seccion: 'A', especialidad: 'Informática' }],
    materias: [{ id: 'm1', nombre: 'Matemática' }, { id: 'm2', nombre: 'Lengua' }],
    docentes: [{ id: 'd1', nombre: 'Prof. Carmen Peña' }],
    matriculas: [est('e1', 'Ana', 'Uno', 'K-1'), est('e2', 'Beto', 'Dos', 'K-2'), est('e3', 'Carla', 'Tres', 'K-3'), est('e4', 'Dani', 'Cuatro', 'K-4')],
    asistencias: [] as unknown[],
    asistencia_sesiones: [] as unknown[],
  };
}

const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const porTexto = (sel: string, t: string, el: ParentNode = document) => q(sel, el).find((e) => e.textContent?.includes(t)) as HTMLElement | undefined;
const esperar = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const escribir = async (n: Element, v: string) => {
  const proto = n instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  await act(async () => { set.call(n, v); n.dispatchEvent(new window.Event(n instanceof window.HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
};
const grupo = (nombre: string) => q(`[role=group][aria-label="Estado de ${nombre}"]`)[0] as HTMLElement;
const marcar = async (nombre: string, estado: string) => click(porTexto('button', estado, grupo(nombre)));

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
  vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0)); // sábado 10 de octubre de 2026
  mock.rol = 'docente';
  mock.datos = datosBase();
  mock.rpc.mockReset().mockResolvedValue({
    data: { total: 4, presentes: 3, ausentes: 1, tardanzas: 0, excusas: 0, avisos_creados: 1, avisos_existentes: 0, ausentes_sin_tutor: [] },
    error: null,
  });
  window.localStorage.clear();
});
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('Asistencia', () => {
  it('muestra la clase de trabajo y la lista con todos presentes por defecto', async () => {
    const el = await montar();
    const select = q('select', el)[0] as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(['4.º A, Informática · Lengua', '4.º A, Informática · Matemática']);
    expect(el.textContent).toContain('Uno, Ana');
    expect(el.textContent).toContain('Presentes: 4');
    expect(el.textContent).toContain('Ausentes: 0');
    expect(q('button[aria-pressed=true]', el)).toHaveLength(4);
    expect(el.textContent).toContain('sábado, 10 de octubre de 2026');
  });

  it('recuerda la clase de trabajo elegida', async () => {
    let el = await montar();
    await escribir(q('select', el)[0], 's1');
    expect(window.localStorage.getItem('poli:claseTrabajo')).toBe('s1');
    document.body.innerHTML = '';
    el = await montar();
    expect((q('select', el)[0] as HTMLSelectElement).value).toBe('s1');
  });

  it('marca ausentes, actualiza los conteos y guarda toda la lista', async () => {
    const el = await montar();
    await escribir(q('select', el)[0], 's1');
    await marcar('Ana Uno', 'Ausente');
    await marcar('Beto Dos', 'Tarde');
    expect(el.textContent).toContain('Ausentes: 1');
    expect(el.textContent).toContain('Tarde: 1');
    expect(el.textContent).toContain('Presentes: 2');
    await click(porTexto('button', 'Guardar asistencia', el));
    await esperar();
    expect(mock.rpc).toHaveBeenCalledTimes(1);
    const [nombre, args] = mock.rpc.mock.calls[0];
    expect(nombre).toBe('guardar_asistencia');
    expect(args.p_asignacion_id).toBe('s1');
    expect(args.p_fecha).toBe('2026-10-10');
    expect(args.p_registros).toHaveLength(4);
    expect(args.p_registros).toContainEqual({ estudiante_id: 'e1', estado: 'ausente' });
    expect(args.p_registros).toContainEqual({ estudiante_id: 'e2', estado: 'tardanza' });
    expect(args.p_registros).toContainEqual({ estudiante_id: 'e3', estado: 'presente' });
    expect(el.textContent).toContain('Asistencia guardada: 3 presentes, 1 ausentes');
    expect(el.textContent).toContain('Se prepararon 1 avisos para los tutores');
    expect(porTexto('button', 'Ir a Avisos a tutores', el)).toBeDefined();
  });

  it('avisa de los ausentes que no tienen tutor', async () => {
    mock.rpc.mockResolvedValue({ data: { total: 4, presentes: 3, ausentes: 1, tardanzas: 0, excusas: 0, avisos_creados: 0, avisos_existentes: 0, ausentes_sin_tutor: ['Carla Tres'] }, error: null });
    const el = await montar();
    await marcar('Carla Tres', 'Ausente');
    await click(porTexto('button', 'Guardar asistencia', el));
    await esperar();
    expect(el.textContent).toContain('No se pudo preparar el aviso de Carla Tres');
  });

  it('"Todos presentes" deshace las marcas', async () => {
    const el = await montar();
    await marcar('Ana Uno', 'Ausente');
    await marcar('Dani Cuatro', 'Excusa');
    await click(porTexto('button', 'Todos presentes', el));
    expect(el.textContent).toContain('Presentes: 4');
  });

  it('carga una lista ya registrada y ofrece guardar correcciones', async () => {
    mock.datos.asistencias = [{ estudiante_id: 'e1', estado: 'ausente' }, { estudiante_id: 'e2', estado: 'presente' }, { estudiante_id: 'e3', estado: 'excusa' }, { estudiante_id: 'e4', estado: 'tardanza' }];
    mock.datos.asistencia_sesiones = [{ registrado_en: '2026-10-10T14:00:00Z' }];
    const el = await montar();
    expect(el.textContent).toContain('Lista ya registrada');
    expect(el.textContent).toContain('Ausentes: 1');
    expect(el.textContent).toContain('Excusa: 1');
    expect(porTexto('button', 'Guardar correcciones', el)).toBeDefined();
  });

  it('el docente no puede pasar lista de hace más de 3 días', async () => {
    const el = await montar();
    const fecha = q('input[type=date]', el)[0] as HTMLInputElement;
    expect(fecha.max).toBe('2026-10-10');
    expect(fecha.min).toBe('2026-10-07');
    await escribir(fecha, '2026-10-06');
    expect(el.textContent).toContain('Solo puedes pasar o corregir la lista de los últimos 3 días');
    expect(porTexto('button', 'Guardar asistencia', el)).toBeUndefined();
    await escribir(fecha, '2026-10-07');
    expect(el.textContent).not.toContain('Solo puedes pasar');
    expect(porTexto('button', 'Guardar asistencia', el)).toBeDefined();
  });

  it('coordinación puede elegir fechas anteriores y ve el nombre del docente', async () => {
    mock.rol = 'coordinacion';
    const el = await montar();
    const fecha = q('input[type=date]', el)[0] as HTMLInputElement;
    expect(fecha.min).toBe('');
    expect((q('select', el)[0] as HTMLSelectElement).options[0].textContent).toContain('Prof. Carmen Peña');
    await escribir(fecha, '2026-09-01');
    expect(porTexto('button', 'Guardar asistencia', el)).toBeDefined();
  });

  it('muestra el error de la base de datos al guardar', async () => {
    mock.rpc.mockResolvedValue({ data: null, error: { code: '22023', message: 'Esta clase no es tuya.' } });
    const el = await montar();
    await click(porTexto('button', 'Guardar asistencia', el));
    await esperar();
    expect(el.textContent).toContain('Esta clase no es tuya.');
  });

  it('explica qué hacer cuando no hay clases asignadas', async () => {
    mock.datos.asignaciones = [];
    const el = await montar();
    expect(el.textContent).toContain('No tienes clases asignadas todavía');
  });
});
