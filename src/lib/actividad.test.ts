import { afterEach, describe, expect, it, vi } from 'vitest';
import { actividad, fetchConActividad } from './actividad';
import { supabase } from './supabase';

afterEach(() => {
  vi.unstubAllGlobals();
  while (actividad.contar() > 0) actividad.fin();
});

describe('contador de actividad', () => {
  it('cuenta las peticiones en curso y avisa a quien escucha', () => {
    const avisos: number[] = [];
    const cancelar = actividad.suscribir(() => avisos.push(actividad.contar()));
    actividad.inicio();
    actividad.inicio();
    actividad.fin();
    actividad.fin();
    cancelar();
    actividad.inicio();   // ya nadie escucha
    expect(avisos).toEqual([1, 2, 1, 0]);
  });
  it('nunca baja de cero', () => {
    actividad.fin();
    actividad.fin();
    expect(actividad.contar()).toBe(0);
  });
});

describe('fetch con actividad', () => {
  it('cuenta la petición mientras está pendiente y la descuenta al terminar', async () => {
    let responder: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((res) => { responder = res; })));
    const promesa = fetchConActividad('https://ejemplo.test/rest/v1/estudiantes');
    expect(actividad.contar()).toBe(1);
    responder(new Response('ok'));
    expect((await promesa).status).toBe(200);
    expect(actividad.contar()).toBe(0);
  });
  it('también la descuenta si la petición falla, y deja pasar el error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(fetchConActividad('https://ejemplo.test')).rejects.toThrow('Failed to fetch');
    expect(actividad.contar()).toBe(0);
  });
  it('reenvía la dirección y las opciones tal cual', async () => {
    const falso = vi.fn(() => Promise.resolve(new Response('ok')));
    vi.stubGlobal('fetch', falso);
    await fetchConActividad('https://ejemplo.test/x', { method: 'POST', body: '{}' });
    expect(falso).toHaveBeenCalledWith('https://ejemplo.test/x', { method: 'POST', body: '{}' });
  });
});

describe('cliente de la base de datos', () => {
  it('toda consulta que hace el cliente de Supabase cuenta como actividad (así la animación aparece en cualquier pantalla)', async () => {
    let responder: (r: Response) => void = () => {};
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((res) => { responder = res; })));
    const consulta = supabase.from('estudiantes').select('*').then(() => 'listo');
    await new Promise((r) => setTimeout(r, 20));
    expect(actividad.contar()).toBeGreaterThan(0);
    responder(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    expect(await consulta).toBe('listo');
    expect(actividad.contar()).toBe(0);
  });
});
