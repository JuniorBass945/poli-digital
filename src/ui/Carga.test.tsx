// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { actividad } from '../lib/actividad';
import { CargaGlobal, EnCarga, Spinner } from './Carga';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const q = (sel: string) => [...document.querySelectorAll(sel)] as HTMLElement[];
const pasar = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const barraVisible = () => (q('[data-testid="barra-carga"]')[0].parentElement as HTMLElement).className.includes('opacity-100');

async function montar() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => { createRoot(el).render(<CargaGlobal />); });
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => {
  while (actividad.contar() > 0) actividad.fin();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('animación de carga global', () => {
  it('no muestra nada si no hay peticiones', async () => {
    await montar();
    await pasar(2000);
    expect(barraVisible()).toBe(false);
    expect(q('[role=status]')).toHaveLength(0);
  });

  it('las peticiones muy rápidas no hacen parpadear la pantalla', async () => {
    await montar();
    await act(async () => { actividad.inicio(); });
    await pasar(100);
    await act(async () => { actividad.fin(); });
    await pasar(1000);
    expect(barraVisible()).toBe(false);
  });

  it('si la petición tarda, aparece la barra y luego el aviso con texto', async () => {
    await montar();
    await act(async () => { actividad.inicio(); });
    await pasar(200);
    expect(barraVisible()).toBe(true);
    expect(q('[role=status]')).toHaveLength(0);       // todavía no el aviso
    await pasar(1100);
    expect(q('[role=status]')[0].textContent).toContain('Cargando…');
  });

  it('al terminar se retira sola, aunque queden varias peticiones a la vez hasta la última', async () => {
    await montar();
    await act(async () => { actividad.inicio(); actividad.inicio(); });
    await pasar(1400);
    await act(async () => { actividad.fin(); });
    await pasar(500);
    expect(barraVisible()).toBe(true);                // sigue una petición
    await act(async () => { actividad.fin(); });
    await pasar(400);
    expect(barraVisible()).toBe(false);
    expect(q('[role=status]')).toHaveLength(0);
  });
});

describe('piezas de carga', () => {
  it('EnCarga muestra el texto con su círculo', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => { createRoot(el).render(<><EnCarga /><EnCarga texto="Cargando avisos…" /></>); });
    expect(el.textContent).toBe('Cargando…Cargando avisos…');
    expect(q('[role=status]')).toHaveLength(2);
  });
  it('Spinner acepta un tamaño', async () => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    await act(async () => { createRoot(el).render(<Spinner tamano={30} />); });
    expect((el.firstElementChild as HTMLElement).style.width).toBe('30px');
  });
});
