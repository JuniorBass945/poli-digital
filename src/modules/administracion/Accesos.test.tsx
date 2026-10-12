// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  rpc: vi.fn(),
  invocar: vi.fn(),
  datos: {} as Record<string, unknown[]>,
  parecidos: [] as unknown[],
}));

vi.mock('../../auth/AuthProvider', () => ({ useAuth: () => ({ perfil: { id: 'yo', rol: 'admin', roles: ['admin'], nombre: 'Admin' } }) }));
vi.mock('../../lib/supabase', () => {
  const qb = (tabla: string) => {
    const o: Record<string, unknown> = {
      select: () => o, eq: () => o, order: () => o, range: () => o,
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve({ data: mock.datos[tabla] ?? [], error: null }).then(res, rej),
    };
    return o;
  };
  return { supabase: { from: qb, rpc: (...a: unknown[]) => mock.rpc(...a), functions: { invoke: (...a: unknown[]) => mock.invocar(...a) } } };
});

import Accesos from './Accesos';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const fila = (o: Record<string, unknown>) => ({
  id: 'x', nombre: 'X', titulo: null, nombres: null, apellido1: null, apellido2: null, usuario: 'x', correo: null, activo: true, roles: ['docente'], docente_id: null,
  estado: 'activo', clave_vence: null, ultimo_ingreso: null, ...o,
});

const q = (sel: string, el: ParentNode = document) => [...el.querySelectorAll(sel)];
const esperar = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };
const click = async (n?: Element) => { if (!n) throw new Error('no se encontró el elemento'); await act(async () => { n.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }); };
const escribir = async (n: Element, v: string) => {
  const proto = n instanceof window.HTMLSelectElement ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const set = Object.getOwnPropertyDescriptor(proto, 'value')!.set!;
  await act(async () => { set.call(n, v); n.dispatchEvent(new window.Event(n instanceof window.HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
};
const campo = (etiqueta: string) => {
  const raiz = document.querySelector('[role=dialog]') ?? document;
  const l = q('label', raiz).find((e) => e.textContent?.includes(etiqueta));
  if (!l) throw new Error(`no se encontró el campo "${etiqueta}"`);
  return l.querySelector('input,select')!;
};
const nombre = async (nombres: string, ap1: string, ap2 = '') => {
  await escribir(campo('Nombre(s)'), nombres);
  await escribir(campo('1.er apellido'), ap1);
  if (ap2) await escribir(campo('2.º apellido'), ap2);
};
const salir = async (n: Element) => { await act(async () => { n.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true })); }); await esperar(); };
const botonDialogo = (texto: string) => q('[role=dialog] button').find((b) => b.textContent === texto) as HTMLButtonElement;
const interruptor = (rol: string) => q('[role=dialog] [role=switch]').find((b) => b.textContent?.startsWith(rol)) as HTMLElement;

async function abrir() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  await act(async () => { createRoot(el).render(<Accesos />); });
  await esperar();
  return el;
}

beforeEach(() => {
  mock.rpc.mockReset();
  mock.invocar.mockReset();
  mock.parecidos = [];
  mock.datos = {
    docentes: [
      { id: 'd1', nombre: 'Prof. Libre', correo: null, activo: true, baja_motivo: null, baja_nota: null, perfil_id: null },
      { id: 'd2', nombre: 'Prof. Ocupado', correo: null, activo: true, baja_motivo: null, baja_nota: null, perfil_id: 'p9' },
    ],
  };
  mock.rpc.mockImplementation((nombre: string) => {
    if (nombre === 'listar_accesos') {
      return Promise.resolve({
        data: [
          fila({ id: 'yo', nombre: 'Admin Demo', usuario: null, correo: 'admin@polidemo.test', roles: ['admin'] }),
          fila({ id: 'p1', nombre: 'Prof. Carmen Peña', usuario: 'cpena', roles: ['docente', 'orientacion'], docente_id: 'd9' }),
          fila({ id: 'p2', nombre: 'Luis Nuevo', usuario: 'lnuevo', roles: ['direccion'], estado: 'pendiente', clave_vence: '2026-10-20T12:00:00Z' }),
          fila({ id: 'p3', nombre: 'Rosa Fuera', usuario: 'rfuera', roles: ['coordinacion'], estado: 'sin_acceso', activo: false }),
        ],
        error: null,
      });
    }
    if (nombre === 'sugerir_usuario_partes') return Promise.resolve({ data: 'ana', error: null });
    if (nombre === 'buscar_personas') return Promise.resolve({ data: mock.parecidos, error: null });
    return Promise.resolve({ data: null, error: null });
  });
});
afterEach(() => { document.body.innerHTML = ''; });

describe('Accesos', () => {
  it('lista a las personas con roles y estado, y oculta a quien no tiene acceso', async () => {
    const el = await abrir();
    expect(el.textContent).toContain('Prof. Carmen Peña');
    expect(el.textContent).toContain('Usuario: cpena');
    expect(el.textContent).toContain('Docente');
    expect(el.textContent).toContain('Orientación y psicología');
    expect(el.textContent).toContain('Debe cambiar su clave');
    expect(el.textContent).toContain('Correo: admin@polidemo.test');
    expect(el.textContent).not.toContain('Rosa Fuera');
    await click(q('input[type=checkbox]', el)[0]);
    expect(el.textContent).toContain('Rosa Fuera');
    expect(el.textContent).toContain('Sin acceso');
  });

  it('en tu propia fila no se puede quitar el acceso ni restablecer la clave', async () => {
    const el = await abrir();
    expect(q('button[aria-label="Quitar el acceso a Admin Demo"]', el)).toHaveLength(0);
    expect(q('button[aria-label="Restablecer la clave de Admin Demo"]', el)).toHaveLength(0);
    expect(q('button[aria-label="Cambiar roles de Admin Demo"]', el)).toHaveLength(1);
    expect(q('button[aria-label="Quitar el acceso a Prof. Carmen Peña"]', el)).toHaveLength(1);
  });

  it('crear un acceso: propone el usuario, exige roles y muestra la clave temporal una sola vez', async () => {
    mock.invocar.mockResolvedValue({ data: { usuario: 'ana', claveTemporal: 'Ab3d-Ef5g-Hj7k', vence: '2026-10-20T12:00:00Z', perfilId: 'n1' }, error: null });
    const el = await abrir();
    await click(q('button', el).find((b) => b.textContent?.includes('Nuevo acceso')));
    await escribir(campo('Título'), 'Lic.');
    await nombre('Ana María', 'Pérez');
    await salir(campo('1.er apellido'));
    expect((campo('Usuario (solo') as HTMLInputElement).value).toBe('ana');

    await click(botonDialogo('Crear acceso'));
    expect(mock.invocar).not.toHaveBeenCalled();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Activa al menos un rol');

    await click(interruptor('Dirección'));
    await click(botonDialogo('Crear acceso'));
    await esperar();
    expect(mock.invocar).toHaveBeenCalledWith('accesos', { body: { accion: 'crear', usuario: 'ana', nombre: 'Lic. Ana María Pérez', otraPersona: false, roles: ['direccion'], docenteId: null, crearDocente: false, titulo: 'Lic.', nombres: 'Ana María', apellido1: 'Pérez', apellido2: null } });
    const dlg = document.querySelector('[role=dialog]')!;
    expect(dlg.textContent).toContain('Acceso creado');
    expect(dlg.textContent).toContain('se muestra una sola vez');
    expect(dlg.querySelector('[data-testid=clave-temporal]')?.textContent).toBe('Ab3d-Ef5g-Hj7k');
    await click(botonDialogo('Listo, ya la anoté'));
    expect(document.body.textContent).not.toContain('Ab3d-Ef5g-Hj7k');
  });

  it('la clave temporal se puede escribir a mano: se valida y se envía al servidor', async () => {
    mock.invocar.mockResolvedValue({ data: { usuario: 'agil', claveTemporal: 'Escuela2026', vence: '2026-10-20T12:00:00Z', perfilId: 'n1' }, error: null });
    const el = await abrir();
    await click(q('button', el).find((b) => b.textContent?.includes('Nuevo acceso')));
    await nombre('Ana', 'Gil');
    await escribir(campo('Usuario (solo'), 'agil');
    await click(interruptor('Dirección'));
    expect(q('[role=dialog] input[type=radio]')).toHaveLength(2);
    expect((q('[role=dialog] input[type=radio]')[0] as HTMLInputElement).checked).toBe(true);   // por defecto: automática
    await click(q('[role=dialog] input[type=radio]')[1]);
    await escribir(campo('Clave temporal escrita'), 'corta');
    await click(botonDialogo('Crear acceso'));
    expect(mock.invocar).not.toHaveBeenCalled();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('al menos 8 caracteres');
    await escribir(campo('Clave temporal escrita'), 'Escuela2026');
    await click(botonDialogo('Crear acceso'));
    await esperar();
    expect(mock.invocar).toHaveBeenCalledWith('accesos', { body: expect.objectContaining({ accion: 'crear', usuario: 'agil', claveManual: 'Escuela2026' }) });
    expect(document.querySelector('[data-testid=clave-temporal]')?.textContent).toBe('Escuela2026');
  });

  it('con la clave automática no se manda ninguna clave manual', async () => {
    mock.invocar.mockResolvedValue({ data: { usuario: 'ana', claveTemporal: 'Ab3d-Ef5g-Hj7k', vence: '2026-10-20T12:00:00Z', perfilId: 'n1' }, error: null });
    const el = await abrir();
    await click(q('button', el).find((b) => b.textContent?.includes('Nuevo acceso')));
    await nombre('Ana', 'Gil');
    await escribir(campo('Usuario (solo'), 'agil');
    await click(interruptor('Dirección'));
    await click(botonDialogo('Crear acceso'));
    await esperar();
    expect((mock.invocar.mock.calls[0][1] as { body: Record<string, unknown> }).body.claveManual).toBeUndefined();
  });

  it('restablecer la clave también permite escribirla a mano', async () => {
    mock.invocar.mockResolvedValue({ data: { usuario: 'cpena', claveTemporal: 'Nueva2026', vence: '2026-10-20T12:00:00Z' }, error: null });
    const el = await abrir();
    await click(q('button[aria-label="Restablecer la clave de Prof. Carmen Peña"]', el)[0]);
    await click(q('[role=dialog] input[type=radio]')[1]);
    await escribir(campo('Clave temporal escrita'), 'cpena');
    expect(botonDialogo('Guardar clave temporal').disabled).toBe(true);   // igual al usuario: no se permite
    await escribir(campo('Clave temporal escrita'), 'Nueva2026');
    await click(botonDialogo('Guardar clave temporal'));
    await esperar();
    expect(mock.invocar).toHaveBeenCalledWith('accesos', { body: { accion: 'reiniciar', perfilId: 'p1', claveManual: 'Nueva2026' } });
  });

  it('el rol Docente pide vincular o crear el registro, y solo ofrece docentes sin acceso', async () => {
    mock.invocar.mockResolvedValue({ data: { usuario: 'ana', claveTemporal: 'Ab3d-Ef5g-Hj7k', vence: '2026-10-20T12:00:00Z', perfilId: 'n1' }, error: null });
    const el = await abrir();
    await click(q('button', el).find((b) => b.textContent?.includes('Nuevo acceso')));
    await nombre('Ana', 'Gil');
    await escribir(campo('Usuario (solo'), 'agil');
    expect(q('[role=dialog] select')).toHaveLength(1);   // solo el título: aún no hay selector de docente
    await click(interruptor('Docente'));
    const opciones = q('option', campo('Registro de docente').parentElement!).map((o) => o.textContent);
    expect(opciones.some((t) => t?.includes('Prof. Libre'))).toBe(true);
    expect(opciones.some((t) => t?.includes('Prof. Ocupado'))).toBe(false);

    await click(botonDialogo('Crear acceso'));
    expect(mock.invocar).not.toHaveBeenCalled();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('necesita un registro de docente');

    await escribir(campo('Registro de docente'), 'd1');
    await click(botonDialogo('Crear acceso'));
    await esperar();
    expect(mock.invocar).toHaveBeenCalledWith('accesos', { body: expect.objectContaining({ roles: ['docente'], docenteId: 'd1', crearDocente: false }) });
  });

  it('un usuario repetido muestra el aviso del servidor y no cierra el formulario', async () => {
    mock.invocar.mockResolvedValue({ data: null, error: Object.assign(new Error('x'), { name: 'FunctionsFetchError' }) });
    const el = await abrir();
    await click(q('button', el).find((b) => b.textContent?.includes('Nuevo acceso')));
    await nombre('Ana', 'Gil');
    await escribir(campo('Usuario (solo'), 'cpena');
    await click(interruptor('Dirección'));
    await click(botonDialogo('Crear acceso'));
    await esperar();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('No se pudo contactar con el servidor de accesos');
  });

  it('cambiar los roles manda todos los roles elegidos', async () => {
    const el = await abrir();
    await click(q('button[aria-label="Cambiar roles de Luis Nuevo"]', el)[0]);
    await click(interruptor('Coordinación'));
    await click(botonDialogo('Guardar cambios'));
    await esperar();
    expect(mock.rpc).toHaveBeenCalledWith('cambiar_roles_acceso', { p_perfil_id: 'p2', p_roles: ['direccion', 'coordinacion'], p_docente_id: null, p_crear_docente: false });
  });

  it('quitar el rol docente avisa que el registro de docente se conserva', async () => {
    const el = await abrir();
    await click(q('button[aria-label="Cambiar roles de Prof. Carmen Peña"]', el)[0]);
    expect(document.querySelector('[role=dialog]')?.textContent).not.toContain('se conserva');
    await click(interruptor('Docente'));
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('se conserva');
  });

  it('restablecer la clave pide confirmación y muestra la clave nueva', async () => {
    mock.invocar.mockResolvedValue({ data: { usuario: 'cpena', claveTemporal: 'Zx9y-Wv8u-Ts7r', vence: '2026-10-20T12:00:00Z' }, error: null });
    const el = await abrir();
    await click(q('button[aria-label="Restablecer la clave de Prof. Carmen Peña"]', el)[0]);
    await click(botonDialogo('Guardar clave temporal'));
    await esperar();
    expect(mock.invocar).toHaveBeenCalledWith('accesos', { body: { accion: 'reiniciar', perfilId: 'p1', claveManual: undefined } });
    expect(document.querySelector('[data-testid=clave-temporal]')?.textContent).toBe('Zx9y-Wv8u-Ts7r');
  });

  it('quitar el acceso y reactivarlo', async () => {
    mock.invocar.mockResolvedValue({ data: { ok: true }, error: null });
    const el = await abrir();
    await click(q('button[aria-label="Quitar el acceso a Luis Nuevo"]', el)[0]);
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('No se borra nada');
    await click(botonDialogo('Quitar acceso'));
    await esperar();
    expect(mock.invocar).toHaveBeenCalledWith('accesos', { body: { accion: 'quitar', perfilId: 'p2' } });
    expect(el.textContent).toContain('ya no puede entrar al sistema');

    await click(q('input[type=checkbox]', el)[0]);
    expect(q('button[aria-label="Reactivar a Rosa Fuera"]', el)).toHaveLength(1);
  });

  it('el formulario tiene título (lista), nombres y apellidos por separado, y el 2.º apellido es opcional', async () => {
    const el = await abrir();
    await click(q('button', el).find((b) => b.textContent?.includes('Nuevo acceso')));
    const titulo = campo('Título') as HTMLSelectElement;
    expect([...titulo.options].map((o) => o.textContent)).toEqual(expect.arrayContaining(['Sin título', 'Lic.', 'Licda.', 'Ing.']));
    await click(interruptor('Dirección'));
    await escribir(campo('Usuario (solo'), 'zz');
    await click(botonDialogo('Crear acceso'));
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Escribe los nombres.');
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('Escribe el primer apellido.');
    expect(document.querySelector('[role=dialog]')?.textContent).not.toContain('2.º apellido es obligatorio');
    expect(mock.invocar).not.toHaveBeenCalled();
  });

  it('si la persona ya es un docente sin acceso, se elige en lugar de crearla otra vez', async () => {
    mock.invocar.mockResolvedValue({ data: { usuario: 'ana', claveTemporal: 'Ab3d-Ef5g-Hj7k', vence: '2026-10-20T12:00:00Z', perfilId: 'n1' }, error: null });
    mock.datos.docentes = [
      { id: 'd1', nombre: 'Licda. Ana Gil Pérez', titulo: 'Licda.', nombres: 'Ana', apellido1: 'Gil', apellido2: 'Pérez', correo: null, activo: true, baja_motivo: null, baja_nota: null, perfil_id: null },
    ];
    mock.parecidos = [{ tipo: 'docente', id: 'd1', nombre: 'Licda. Ana Gil Pérez', activo: true, tiene_acceso: false, exacta: false }];
    const el = await abrir();
    await click(q('button', el).find((b) => b.textContent?.includes('Nuevo acceso')));
    await nombre('Ana', 'Gil');
    await salir(campo('1.er apellido'));
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('¿Es alguna de ellas?');
    await click(q('[role=dialog] button').find((b) => b.getAttribute('aria-label') === 'Es Licda. Ana Gil Pérez'));
    expect((campo('Nombre(s)') as HTMLInputElement).value).toBe('Ana');
    expect((campo('2.º apellido') as HTMLInputElement).value).toBe('Pérez');
    expect((campo('Título') as HTMLSelectElement).value).toBe('Licda.');
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('No se creará otra vez');
    expect(interruptor('Docente').getAttribute('aria-checked')).toBe('true');
    await click(botonDialogo('Crear acceso'));
    await esperar();
    expect(mock.invocar).toHaveBeenCalledWith('accesos', { body: expect.objectContaining({
      roles: ['docente'], docenteId: 'd1', crearDocente: false, otraPersona: false, nombres: 'Ana', apellido1: 'Gil', apellido2: 'Pérez', titulo: 'Licda.',
    }) });
  });

  it('con una persona parecida no deja continuar hasta confirmar que es otra, y entonces lo avisa al servidor', async () => {
    mock.invocar.mockResolvedValue({ data: { usuario: 'ana', claveTemporal: 'Ab3d-Ef5g-Hj7k', vence: '2026-10-20T12:00:00Z', perfilId: 'n1' }, error: null });
    mock.parecidos = [{ tipo: 'acceso', id: 'p1', nombre: 'Prof. Ana Gil', activo: true, tiene_acceso: true, exacta: true }];
    const el = await abrir();
    await click(q('button', el).find((b) => b.textContent?.includes('Nuevo acceso')));
    await nombre('Ana', 'Gil');
    await salir(campo('1.er apellido'));
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('ya tiene acceso');
    await click(interruptor('Dirección'));
    await click(botonDialogo('Crear acceso'));
    expect(mock.invocar).not.toHaveBeenCalled();
    expect(document.querySelector('[role=dialog]')?.textContent).toContain('confirma que es otra persona');
    await click(q('[role=dialog] input[type=checkbox]')[0]);
    await click(botonDialogo('Crear acceso'));
    await esperar();
    expect(mock.invocar).toHaveBeenCalledWith('accesos', { body: expect.objectContaining({ otraPersona: true, docenteId: null }) });
  });

  it('editar una persona: propone el nombre dividido y guarda las partes', async () => {
    const el = await abrir();
    await click(q('button[aria-label="Cambiar roles de Prof. Carmen Peña"]', el)[0]);
    expect((campo('Título') as HTMLSelectElement).value).toBe('Prof.');
    expect((campo('Nombre(s)') as HTMLInputElement).value).toBe('Carmen');
    expect((campo('1.er apellido') as HTMLInputElement).value).toBe('Peña');
    await escribir(campo('2.º apellido'), 'Soto');
    await click(botonDialogo('Guardar cambios'));
    await esperar();
    expect(mock.rpc).toHaveBeenCalledWith('actualizar_persona_acceso', { p_perfil_id: 'p1', p_titulo: 'Prof.', p_nombres: 'Carmen', p_apellido1: 'Peña', p_apellido2: 'Soto' });
  });
});
