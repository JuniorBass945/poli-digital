// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  rol: 'direccion' as string,
  usuario: 'u1' as string,
  activos: new Set<string>(),
  datos: {} as Record<string, unknown[]>,
  conteos: {} as Record<string, number>,
  panel: null as unknown,
  pendientes: null as unknown,
  errorRpc: null as string | null,
  llamadasRpc: [] as string[],
}));

vi.mock('../lib/supabase', () => {
  const qb = (tabla: string) => {
    const o: Record<string, unknown> = {
      select: () => o, eq: () => o, order: () => o, range: () => o,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve({ data: mock.datos[tabla] ?? [], count: mock.conteos[tabla] ?? 0, error: null }).then(res, rej),
    };
    return o;
  };
  return {
    supabase: {
      from: qb,
      rpc: (nombre: string) => {
        mock.llamadasRpc.push(nombre);
        if (mock.errorRpc) return Promise.resolve({ data: null, error: { message: mock.errorRpc, code: '22023' } });
        return Promise.resolve(nombre === 'panel_asistencia' ? mock.panel : mock.pendientes).then((data) => ({ data, error: null }));
      },
    },
  };
});
vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    perfil: { id: mock.usuario, centroId: 'c1', centroNombre: 'Centro Demo', rol: mock.rol, nombre: 'Usuario Prueba' },
    modulosActivos: mock.activos,
  }),
}));

import Inicio from './Inicio';
import { limpiarMemoriaInicio } from './inicio/piezas';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const dia = (fecha: string, total: number, presentes: number, tardanzas: number, ausentes: number) => ({ fecha, total, presentes, tardanzas, ausentes, excusas: 0, pct: Math.round((1000 * (presentes + tardanzas)) / total) / 10 });
const PANEL = {
  desde: '2026-09-29', hasta: '2026-10-12', umbral: 3, hoy: '2026-10-12',
  resumen: { total: 400, presentes: 351, ausentes: 39, tardanzas: 14, excusas: 0, pct_asistencia: 91.3, listas: 40, estudiantes: 40, dias_con_lista: 4 },
  por_dia: [dia('2026-09-30', 100, 85, 5, 10), dia('2026-10-01', 100, 80, 4, 16), dia('2026-10-07', 100, 92, 3, 5), dia('2026-10-08', 100, 94, 2, 4)],
  por_aula: [
    { aula_id: 'a1', aula: '4.º A, Informática', listas: 10, total: 100, presentes: 90, ausentes: 8, tardanzas: 2, excusas: 0, pct: 96 },
    { aula_id: 'a2', aula: '4.º B, Electricidad', listas: 10, total: 100, presentes: 70, ausentes: 30, tardanzas: 0, excusas: 0, pct: 78 },
    { aula_id: 'a3', aula: '4.º C, Contabilidad', listas: 10, total: 100, presentes: 88, ausentes: 12, tardanzas: 0, excusas: 0, pct: 90 },
    { aula_id: 'a4', aula: '5.º A', listas: 10, total: 100, presentes: 99, ausentes: 1, tardanzas: 0, excusas: 0, pct: 99 },
  ],
  en_riesgo: [
    { estudiante_id: 'e1', nombre: 'Rosario, Starlin', matricula: 'P-1', dias_ausente: 7, tardanzas: 2, ultima_ausencia: '2026-10-08', aula: '4.º B, Electricidad' },
    { estudiante_id: 'e2', nombre: 'Tavárez, Camila', matricula: 'P-2', dias_ausente: 4, tardanzas: 0, ultima_ausencia: '2026-10-07', aula: '4.º A, Informática' },
  ],
  sin_lista_hoy: [
    { asignacion_id: 's1', aula: '4.º A, Informática', materia: 'Lengua', docente: 'Prof. Carmen Peña' },
    { asignacion_id: 's2', aula: '4.º B, Electricidad', materia: 'Física', docente: 'Ing. Kelvin Disla' },
  ],
};
const PENDIENTES = {
  estudiantes_activos: 129, tutores: 120, docentes: 8, aulas: 3,
  estudiantes_sin_tutor: 3, estudiantes_sin_aula: 0, tutores_sin_telefono: 2, tutores_sin_consentimiento: 118, aulas_sin_materias: 1, docentes_sin_clases: 0,
};

const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const porTexto = (sel: string, t: string, el: ParentNode = document) => q(sel, el).find((e) => e.textContent?.includes(t)) as HTMLElement | undefined;
const esperar = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };

async function montar() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<Inicio />); });
  await esperar();
  return el;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 12, 12, 0, 0));   // lunes 12 de octubre de 2026
  mock.rol = 'direccion';
  mock.usuario = 'u1';
  mock.activos = new Set(['asistencia', 'avisos', 'administracion']);
  mock.datos = {};
  mock.conteos = { mensajes: 5 };
  mock.panel = PANEL;
  mock.pendientes = PENDIENTES;
  mock.errorRpc = null;
  mock.llamadasRpc = [];
  window.localStorage.clear();
  window.location.hash = '';
  limpiarMemoriaInicio();
});
afterEach(() => { vi.useRealTimers(); document.body.innerHTML = ''; });

describe('Inicio de dirección', () => {
  it('muestra la asistencia de la semana con su tendencia, las aulas que necesitan atención y el riesgo', async () => {
    const el = await montar();
    expect(el.textContent).toContain('Hola, Usuario Prueba');
    expect(el.textContent).toContain('Dirección en Centro Demo');
    expect(el.textContent).toContain('95.5%');
    expect(el.textContent).toContain('▲ 8.5 puntos más que la semana anterior');
    expect(porTexto('button', 'Ausencias esta semana', el)?.textContent).toContain('9');
    expect(porTexto('button', 'Estudiantes en riesgo', el)?.textContent).toContain('2');
    expect(porTexto('button', 'Avisos por enviar', el)?.textContent).toContain('5');
    const aulas = porTexto('section, div', 'Aulas que necesitan atención', el)!;
    expect(aulas.textContent?.indexOf('4.º B, Electricidad')).toBeLessThan(aulas.textContent?.indexOf('4.º C, Contabilidad') ?? 0);
    expect(el.textContent).not.toContain('5.º A');   // solo las 3 peores
    expect(el.textContent).toContain('Rosario, Starlin');
    expect(el.textContent).toContain('7 días con ausencia');
    expect(q('[role=img][aria-label="Asistencia de los últimos días"] > div', el)).toHaveLength(4);
    expect(el.textContent).toContain('Módulos de tu centro');
  });

  it('los indicadores llevan al módulo correspondiente', async () => {
    const el = await montar();
    await click(porTexto('button', 'Estudiantes en riesgo', el));
    expect(window.location.hash).toBe('#/asistencia');
    await click(porTexto('button', 'Avisos por enviar', el));
    expect(window.location.hash).toBe('#/avisos');
  });

  it('explica cuándo todavía no hay asistencia', async () => {
    mock.panel = { ...PANEL, resumen: { ...PANEL.resumen, total: 0 }, por_dia: [], por_aula: [], en_riesgo: [], sin_lista_hoy: [] };
    const el = await montar();
    expect(el.textContent).toContain('Todavía no hay asistencia registrada');
  });

  it('si el módulo de asistencia no está activo, no consulta el panel', async () => {
    mock.activos = new Set(['administracion']);
    const el = await montar();
    expect(el.textContent).toContain('cuando se active ese módulo');
    expect(mock.llamadasRpc).toEqual([]);
  });

  it('muestra el error en vez de romperse', async () => {
    mock.errorRpc = 'El rango no es válido.';
    const el = await montar();
    expect(el.textContent).toContain('No se pudo cargar el resumen: El rango no es válido.');
  });
});

describe('Rapidez al cargar', () => {
  it('muestra marcadores de carga mientras llegan los datos', async () => {
    let soltar: (v: unknown) => void = () => {};
    mock.panel = new Promise((res) => { soltar = res; }) as unknown;
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => { createRoot(el).render(<Inicio />); });
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(q('[role=status][aria-label="Cargando el resumen"]', el)).toHaveLength(1);
    expect(el.textContent).not.toContain('Asistencia esta semana');
    soltar(PANEL);
    await esperar();
    expect(q('[role=status]', el)).toHaveLength(0);
    expect(el.textContent).toContain('Asistencia esta semana');
  });

  it('al volver al Inicio muestra de inmediato lo anterior y lo actualiza en segundo plano', async () => {
    const primera = await montar();
    expect(primera.textContent).toContain('95.5%');
    expect(mock.llamadasRpc.filter((n) => n === 'panel_asistencia')).toHaveLength(1);
    document.body.innerHTML = '';

    // Segunda visita: la respuesta nueva tarda; mientras tanto ya se ve lo anterior (sin marcadores de carga).
    let soltar: (v: unknown) => void = () => {};
    mock.panel = new Promise((res) => { soltar = res; }) as unknown;
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => { createRoot(el).render(<Inicio />); });
    expect(el.textContent).toContain('95.5%');
    expect(q('[role=status]', el)).toHaveLength(0);
    expect(mock.llamadasRpc.filter((n) => n === 'panel_asistencia')).toHaveLength(2);   // sí se pidió de nuevo

    soltar({ ...PANEL, por_dia: [dia('2026-10-07', 100, 80, 0, 20)] });
    await esperar();
    expect(el.textContent).toContain('80%');   // se actualizó con lo nuevo
  });

  it('la memoria no se comparte entre usuarios', async () => {
    await montar();                     // el usuario u1 ve y recuerda el resumen
    document.body.innerHTML = '';
    mock.usuario = 'u2';                // entra otra persona en el mismo navegador
    let soltar: (v: unknown) => void = () => {};
    mock.panel = new Promise((res) => { soltar = res; }) as unknown;
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => { createRoot(el).render(<Inicio />); });
    expect(q('[role=status]', el)).toHaveLength(1);        // vuelve el esqueleto: no se muestra lo del usuario anterior
    expect(el.textContent).not.toContain('95.5%');
    await act(async () => { soltar(PANEL); await new Promise((r) => setTimeout(r, 20)); });
  });

  it('si la actualización falla, se conserva lo que ya se mostraba', async () => {
    await montar();
    document.body.innerHTML = '';
    mock.errorRpc = 'Sin conexión';
    const el = await montar();
    expect(el.textContent).toContain('95.5%');
    expect(el.textContent).not.toContain('No se pudo cargar el resumen');
  });
});

describe('Inicio de coordinación', () => {
  beforeEach(() => { mock.rol = 'coordinacion'; });

  it('lista las clases que hoy no han pasado lista, con su docente', async () => {
    const el = await montar();
    expect(porTexto('button', 'Clases sin lista hoy', el)?.textContent).toContain('2');
    expect(el.textContent).toContain('Prof. Carmen Peña');
    expect(el.textContent).toContain('Ing. Kelvin Disla');
    expect(el.textContent).toContain('Rosario, Starlin');
  });

  it('en fin de semana no hay clases', async () => {
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0));   // sábado
    const el = await montar();
    expect(el.textContent).toContain('Hoy es fin de semana: no hay clases.');
    expect(porTexto('button', 'Clases sin lista hoy', el)?.textContent).toContain('—');
  });

  it('dice cuando todas las clases ya pasaron lista', async () => {
    mock.panel = { ...PANEL, sin_lista_hoy: [] };
    const el = await montar();
    expect(el.textContent).toContain('Todas las clases ya pasaron lista hoy.');
  });
});

describe('Inicio del docente', () => {
  beforeEach(() => {
    mock.rol = 'docente';
    mock.datos = {
      asignaciones: [{ id: 's1', aula_id: 'a1', materia_id: 'm1', docente_id: 'd1' }, { id: 's2', aula_id: 'a1', materia_id: 'm2', docente_id: 'd1' }],
      aulas: [{ id: 'a1', grado: '4.º', seccion: 'A', especialidad: 'Informática' }],
      materias: [{ id: 'm1', nombre: 'Matemática' }, { id: 'm2', nombre: 'Lengua' }],
      docentes: [{ id: 'd1', nombre: 'Prof. Carmen Peña' }],
      asistencia_sesiones: [{ asignacion_id: 's1' }],
    };
  });

  it('muestra cada clase con su estado y deja primero las que faltan', async () => {
    const el = await montar();
    expect(porTexto('div', 'Listas pasadas hoy', el)?.textContent).toContain('1 de 2');
    const filas = q('li', el).filter((l) => l.textContent?.includes('Informática'));
    expect(filas[0].textContent).toContain('Lengua');
    expect(filas[0].textContent).toContain('Falta pasar lista');
    expect(filas[1].textContent).toContain('Matemática');
    expect(filas[1].textContent).toContain('Lista pasada');
    expect(el.textContent).toContain('Toca "Pasar lista"');
    expect(porTexto('button', 'Avisos por enviar', el)?.textContent).toContain('5');
  });

  it('"Pasar lista" deja elegida la clase de trabajo y abre Asistencia', async () => {
    const el = await montar();
    await click(q('button[aria-label="Pasar lista de 4.º A, Informática · Lengua"]', el)[0]);
    expect(window.localStorage.getItem('poli:claseTrabajo')).toBe('s2');
    expect(window.location.hash).toBe('#/asistencia');
  });

  it('felicita cuando ya pasó lista en todas', async () => {
    mock.datos.asistencia_sesiones = [{ asignacion_id: 's1' }, { asignacion_id: 's2' }];
    const el = await montar();
    expect(el.textContent).toContain('Ya pasaste lista en todas tus clases de hoy');
    expect(q('button[aria-label^="Corregir lista"]', el)).toHaveLength(2);
  });

  it('en fin de semana lo avisa', async () => {
    vi.setSystemTime(new Date(2026, 9, 10, 12, 0, 0));
    const el = await montar();
    expect(el.textContent).toContain('Hoy es fin de semana');
    expect(el.textContent).not.toContain('Ya pasaste lista en todas');
  });

  it('explica cuándo no tiene clases', async () => {
    mock.datos.asignaciones = [];
    const el = await montar();
    expect(el.textContent).toContain('Todavía no tienes clases asignadas');
  });
});

describe('Inicio de administración', () => {
  beforeEach(() => { mock.rol = 'admin'; });

  it('lista los pendientes de datos con su efecto y solo los que tienen algo por hacer', async () => {
    const el = await montar();
    expect(porTexto('button', 'Estudiantes activos', el)?.textContent).toContain('129');
    expect(el.textContent).toContain('Estudiantes sin tutor');
    expect(el.textContent).toContain('No se les puede avisar cuando faltan.');
    expect(el.textContent).toContain('Tutores sin teléfono');
    expect(el.textContent).toContain('Aulas sin materias asignadas');
    expect(el.textContent).toContain('Tutores sin consentimiento de WhatsApp');
    expect(el.textContent).not.toContain('Estudiantes sin aula');   // en cero: no se muestra
    expect(el.textContent).not.toContain('Docentes sin clases');
    await click(q('button[aria-label="Revisar: Tutores sin teléfono"]', el)[0]);
    expect(window.location.hash).toBe('#/administracion');
  });

  it('cuando no falta nada, lo dice', async () => {
    mock.pendientes = { ...PENDIENTES, estudiantes_sin_tutor: 0, tutores_sin_telefono: 0, tutores_sin_consentimiento: 0, aulas_sin_materias: 0 };
    const el = await montar();
    expect(el.textContent).toContain('Todo en orden');
  });

  it('muestra el error en vez de romperse', async () => {
    mock.errorRpc = 'No tienes permiso para ver los pendientes de datos.';
    const el = await montar();
    expect(el.textContent).toContain('No se pudo cargar el resumen');
  });
});

describe('Inicio de orientación y otros roles', () => {
  it('orientación ve a los estudiantes para dar seguimiento', async () => {
    mock.rol = 'orientacion';
    const el = await montar();
    expect(el.textContent).toContain('Estudiantes para dar seguimiento');
    expect(el.textContent).toContain('7 días con ausencia · 2 tardanzas');
    expect(el.textContent).toContain('llegarán con el módulo de orientación');
  });

  it('el tutor conserva la vista básica', async () => {
    mock.rol = 'tutor';
    mock.conteos = { estudiantes: 2, tutores: 1, docentes: 0, aulas: 3 };
    const el = await montar();
    expect(el.textContent).toContain('Lo que tu rol puede ver');
    expect(mock.llamadasRpc).toEqual([]);
  });
});
