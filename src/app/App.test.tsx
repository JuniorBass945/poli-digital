// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Prueba de humo del shell: con un Supabase simulado, el menú muestra solo los módulos
// que el rol puede usar y que tienen la bandera activa.
const estado = vi.hoisted(() => ({
  rol: 'docente' as string,
  modulos: ['asistencia', 'avisos', 'administracion'],
  sesion: true,
}));

vi.mock('../lib/env', () => ({ env: {}, entornoListo: true }));
vi.mock('../lib/supabase', () => {
  const qb = (tabla: string) => {
    const o: Record<string, unknown> = {
      select: () => o,
      eq: () => o,
      order: () => o,
      range: () => o,
      maybeSingle: () =>
        Promise.resolve({
          data: { id: 'u1', centro_id: 'c1', rol: estado.rol, nombre: 'Usuario Prueba', centros: { nombre: 'Centro Demo' } },
          error: null,
        }),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(
          tabla === 'modulos_activos'
            ? { data: estado.modulos.map((modulo) => ({ modulo })), error: null }
            : { count: 7, error: null }
        ).then(res, rej),
    };
    return o;
  };
  return {
    supabase: {
      auth: {
        getSession: () => Promise.resolve({ data: { session: estado.sesion ? { user: { id: 'u1' } } : null } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signOut: () => Promise.resolve({}),
        signInWithPassword: () => Promise.resolve({ error: null }),
      },
      from: qb,
      rpc: () => Promise.resolve({ data: null, error: { message: 'sin datos en la prueba' } }),
    },
  };
});

import App from './App';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

async function montar() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const root = createRoot(el);
  await act(async () => { root.render(<App />); });
  // Espera a que terminen las cargas (sesión, perfil y el módulo diferido).
  for (let i = 0; i < 60; i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    const listo = !el.textContent?.includes('Cargando') && (el.querySelector('main h1') || el.textContent?.includes('Entrar'));
    if (listo) break;
  }
  return { el, root };
}

afterEach(() => { document.body.innerHTML = ''; window.location.hash = ''; });

describe('shell de la aplicación', () => {
  it('sin sesión muestra el inicio de sesión', async () => {
    estado.sesion = false;
    const { el } = await montar();
    expect(el.textContent).toContain('Entrar');
    estado.sesion = true;
  });

  it('el docente ve solo sus módulos activos', async () => {
    estado.rol = 'docente';
    const { el } = await montar();
    const menu = [...el.querySelectorAll('nav button')].map((b) => b.textContent);
    expect(menu).toEqual(['Inicio', 'Asistencia', 'Avisos a tutores']);   // administración está activa pero no es de su rol
    expect(el.textContent).toContain('Hola, Usuario Prueba');
    expect(el.textContent).toContain('Docente en Centro Demo');
  });

  it('el administrador ve la gestión de datos', async () => {
    estado.rol = 'admin';
    const { el } = await montar();
    const menu = [...el.querySelectorAll('nav button')].map((b) => b.textContent);
    expect(menu).toEqual(['Inicio', 'Gestión de datos']);
  });

  it('abrir un módulo pendiente muestra su marcador', async () => {
    // Asistencia y avisos ya existen; se usa Calificaciones (R3), que sigue pendiente.
    estado.rol = 'docente';
    estado.modulos = ['asistencia', 'avisos', 'administracion', 'calificaciones'];
    window.location.hash = '/calificaciones';
    const { el } = await montar();
    estado.modulos = ['asistencia', 'avisos', 'administracion'];
    expect(el.textContent).toContain('En construcción');
    expect(el.textContent).toContain('R3');
  });
});
