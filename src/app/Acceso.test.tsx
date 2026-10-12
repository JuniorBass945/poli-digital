// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Prueba de humo del acceso: login por usuario, clave temporal obligatoria y varios roles.
const estado = vi.hoisted(() => ({
  sesion: true,
  acceso: { debe_cambiar: false, vencida: false, activo: true, nombre: 'Carmen Peña' } as Record<string, unknown>,
  roles: ['docente', 'orientacion'] as string[],
  modulos: ['asistencia', 'avisos', 'administracion', 'orientacion'],
  entradas: [] as Array<Record<string, string>>,
  llamadas: [] as string[],
  updateError: null as null | { message: string },
  marcaError: null as null | { message: string },
}));

vi.mock('../lib/env', () => ({ env: {}, entornoListo: true }));
vi.mock('../lib/supabase', () => {
  const qb = (tabla: string) => {
    const o: Record<string, unknown> = {
      select: () => o, eq: () => o, order: () => o, range: () => o,
      maybeSingle: () =>
        Promise.resolve({
          data: {
            id: 'u1', centro_id: 'c1', rol: estado.roles[0], nombre: 'Carmen Peña', centros: { nombre: 'Centro Demo' },
            perfil_roles: estado.roles.map((rol) => ({ rol })),
          },
          error: null,
        }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(tabla === 'modulos_activos' ? { data: estado.modulos.map((modulo) => ({ modulo })), error: null } : { count: 3, data: [], error: null }).then(res, rej),
    };
    return o;
  };
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: estado.sesion ? { user: { id: 'u1' } } : null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: () => Promise.resolve({}),
        signInWithPassword: (c: Record<string, string>) => { estado.entradas.push(c); return Promise.resolve({ error: null }); },
        updateUser: () => { estado.llamadas.push('updateUser'); return Promise.resolve({ error: estado.updateError }); },
      },
      from: qb,
      rpc: (nombre: string) => {
        estado.llamadas.push(nombre);
        if (nombre === 'mi_estado_acceso') return Promise.resolve({ data: estado.acceso, error: null });
        if (nombre === 'marcar_clave_cambiada') {
          if (!estado.marcaError) estado.acceso = { ...estado.acceso, debe_cambiar: false };
          return Promise.resolve({ data: null, error: estado.marcaError });
        }
        return Promise.resolve({ data: null, error: { message: 'sin datos en la prueba' } });
      },
    },
  };
});

import App from './App';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const escribir = async (n: Element, v: string) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => { set.call(n, v); n.dispatchEvent(new window.Event('input', { bubbles: true })); });
};
const esperar = async () => { for (let i = 0; i < 8; i++) await act(async () => { await new Promise((r) => setTimeout(r, 8)); }); };

async function montar() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => { createRoot(el).render(<App />); });
  await esperar();
  return el;
}

beforeEach(() => {
  estado.sesion = true;
  estado.acceso = { debe_cambiar: false, vencida: false, activo: true, nombre: 'Carmen Peña' };
  estado.roles = ['docente', 'orientacion'];
  estado.entradas = [];
  estado.llamadas = [];
  estado.updateError = null;
  estado.marcaError = null;
});
afterEach(() => { document.body.innerHTML = ''; window.location.hash = ''; });

describe('inicio de sesión con usuario', () => {
  it('pide Usuario (no correo) y entra con el correo interno en minúsculas', async () => {
    estado.sesion = false;
    const el = await montar();
    expect(el.textContent).toContain('Usuario');
    expect(el.textContent).not.toContain('Correo');
    await escribir(q('input[type=text]', el)[0], '  CPena ');
    await escribir(q('input[type=password]', el)[0], 'loquesea');
    await act(async () => { q('form', el)[0].dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })); });
    await esperar();
    expect(estado.entradas).toEqual([{ email: 'cpena@poli.test', password: 'loquesea' }]);
  });
});

describe('clave temporal', () => {
  beforeEach(() => { estado.acceso = { debe_cambiar: true, vencida: false, activo: true, nombre: 'Carmen Peña' }; });

  it('bloquea el sistema y pide elegir una clave propia', async () => {
    const el = await montar();
    expect(el.textContent).toContain('Elige tu clave');
    expect(el.textContent).toContain('Hola, Carmen Peña');
    expect(q('nav', el)).toHaveLength(0);
  });

  it('rechaza claves flojas o distintas sin tocar el servidor', async () => {
    const el = await montar();
    const [a, b] = q('input[type=password]', el);
    await escribir(a, 'corta1');
    await escribir(b, 'corta1');
    await click(q('button', el).find((x) => x.textContent === 'Guardar y entrar'));
    expect(el.textContent).toContain('al menos 8 caracteres');
    await escribir(a, 'Escuela2026');
    await escribir(b, 'Escuela2027');
    await click(q('button', el).find((x) => x.textContent === 'Guardar y entrar'));
    expect(el.textContent).toContain('no coinciden');
    expect(estado.llamadas).not.toContain('updateUser');
  });

  it('cambia la clave, la marca en la base y entra al sistema mostrando el nombre', async () => {
    const el = await montar();
    const [a, b] = q('input[type=password]', el);
    await escribir(a, 'Escuela2026');
    await escribir(b, 'Escuela2026');
    await click(q('button', el).find((x) => x.textContent === 'Guardar y entrar'));
    await esperar(); await esperar(); await esperar();
    expect(estado.llamadas.filter((l) => l === 'updateUser' || l === 'marcar_clave_cambiada')).toEqual(['updateUser', 'marcar_clave_cambiada']);
    expect(q('nav', el).length).toBeGreaterThan(0);
    expect(el.textContent).toContain('Hola, Carmen Peña');
    expect(el.textContent).not.toContain('cpena');
  });

  it('si la base no acepta el cambio, se queda en la pantalla con el motivo', async () => {
    estado.marcaError = { message: 'Todavía no has cambiado tu clave.' };
    const el = await montar();
    const [a, b] = q('input[type=password]', el);
    await escribir(a, 'Escuela2026');
    await escribir(b, 'Escuela2026');
    await click(q('button', el).find((x) => x.textContent === 'Guardar y entrar'));
    await esperar();
    expect(el.textContent).toContain('Todavía no has cambiado tu clave.');
    expect(q('nav', el)).toHaveLength(0);
  });

  it('una clave temporal vencida no deja cambiarla: pide una nueva a la administración', async () => {
    estado.acceso = { debe_cambiar: true, vencida: true, activo: true, nombre: 'Carmen Peña' };
    const el = await montar();
    expect(el.textContent).toContain('venció');
    expect(q('input[type=password]', el)).toHaveLength(0);
  });
});

describe('acceso desactivado', () => {
  it('explica que el acceso está desactivado', async () => {
    estado.acceso = { debe_cambiar: false, vencida: false, activo: false, nombre: 'Carmen Peña' };
    const el = await montar();
    expect(el.textContent).toContain('Tu acceso está desactivado');
    expect(q('nav', el)).toHaveLength(0);
  });
});

describe('varios roles', () => {
  it('el menú suma los módulos de todos los roles y el Inicio tiene una pestaña por rol', async () => {
    const el = await montar();
    const menu = [...el.querySelectorAll('nav button')].map((b) => b.textContent);
    expect(menu).toEqual(['Inicio', 'Asistencia', 'Avisos a tutores', 'Seguimiento']);   // docente + orientación, sin Gestión de datos
    expect(el.textContent).toContain('Hola, Carmen Peña');
    expect(el.textContent).toContain('Docente · Orientación y psicología en Centro Demo');
    const pestanas = q('[role=tab]', el).map((t) => t.textContent);
    expect(pestanas).toEqual(['Docente', 'Orientación y psicología']);
    expect(q('[role=tab]', el)[0].getAttribute('aria-selected')).toBe('true');
    await click(q('[role=tab]', el)[1]);
    expect(q('[role=tab]', el)[1].getAttribute('aria-selected')).toBe('true');
  });

  it('con un solo rol no hay pestañas', async () => {
    estado.roles = ['docente'];
    const el = await montar();
    expect(q('[role=tab]', el)).toHaveLength(0);
    expect(el.textContent).toContain('Docente en Centro Demo');
  });

  it('administración + docente ve la gestión de datos y las clases', async () => {
    estado.roles = ['admin', 'docente'];
    const el = await montar();
    const menu = [...el.querySelectorAll('nav button')].map((b) => b.textContent);
    expect(menu).toContain('Gestión de datos');
    expect(menu).toContain('Asistencia');
  });
});
