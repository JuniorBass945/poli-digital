import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, KeyRound, Pencil, Plus, RotateCcw, Search, UserMinus } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { validarClaveTemporal, validarUsuario } from '../../lib/acceso';
import { cx } from '../../lib/cx';
import { ROLES_ASIGNABLES, ROL_DESCRIPCION, ROL_ETIQUETA, ordenarRoles, type Rol } from '../../lib/roles';
import { Aviso, Btn, Campo, Card, Chip, Modal, inputCls } from '../../ui';
import { EnCarga } from '../../ui/Carga';
import {
  ESTADO_ETIQUETA, ESTADO_TONO, alternarRol, esUnoMismo, mensajeEntrega, paramsDocente, resumenRoles, validarBorradorAcceso, validarRoles,
  type Acceso,
} from './reglasAcceso';
import { cambiarRoles, crearAcceso, listarAccesos, quitarAcceso, reiniciarAcceso, renombrarAcceso, sugerirUsuario, type ClaveEntregada } from './apiAccesos';
import { listarDocentes } from './apiEstructura';
import Confirmar from './Confirmar';
import type { Docente } from './tiposEstructura';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const fechaCorta = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

type Dialogo =
  | { tipo: 'nuevo' }
  | { tipo: 'roles'; a: Acceso }
  | { tipo: 'reiniciar'; a: Acceso }
  | { tipo: 'quitar'; a: Acceso }
  | { tipo: 'clave'; nombre: string; entrega: ClaveEntregada; motivo: 'nuevo' | 'reinicio' }
  | null;

export default function Accesos() {
  const { perfil } = useAuth();
  const [accesos, setAccesos] = useState<Acceso[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [verSinAcceso, setVerSinAcceso] = useState(false);
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  const cargar = useCallback(async () => {
    try {
      const [a, d] = await Promise.all([listarAccesos(), listarDocentes()]);
      setAccesos(a);
      setDocentes(d);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 6000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const terminar = (texto: string | null) => {
    if (texto) setMensaje(texto);
    setCargando(true);
    void cargar();
  };

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return accesos.filter((a) => (verSinAcceso || a.estado !== 'sin_acceso') && (!q || sinTildes(`${a.nombre} ${a.usuario ?? ''} ${a.correo ?? ''}`).includes(q)));
  }, [accesos, busqueda, verSinAcceso]);

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <Campo etiqueta="Buscar">
          <div className="relative w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={`${inputCls} pl-9`} placeholder="Nombre o usuario" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </Campo>
        <label className="flex items-center gap-2 pb-2.5 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={verSinAcceso} onChange={(e) => setVerSinAcceso(e.target.checked)} />
          Mostrar sin acceso
        </label>
        <Btn className="ml-auto" onClick={() => setDialogo({ tipo: 'nuevo' })}>
          <Plus size={16} />
          Nuevo acceso
        </Btn>
      </div>

      {mensaje && <div className="mb-3"><Aviso tono="ok">{mensaje}</Aviso></div>}
      {error && <div className="mb-3"><Aviso tono="bad">{error}</Aviso></div>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-2.5 font-medium">Persona</th>
              <th className="px-3 font-medium">Roles</th>
              <th className="px-3 font-medium">Estado</th>
              <th className="px-3 font-medium">Último ingreso</th>
              <th className="px-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((a) => {
              const yo = esUnoMismo(a, perfil?.id);
              return (
                <tr key={a.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{a.nombre}{yo && <span className="ml-1.5 text-xs font-normal text-muted">(tú)</span>}</div>
                    <div className="text-xs text-muted">{a.usuario ? `Usuario: ${a.usuario}` : a.correo ? `Correo: ${a.correo}` : 'Sin usuario'}</div>
                  </td>
                  <td className="px-3">
                    <div className="flex flex-wrap gap-1">{resumenRoles(a.roles).map((r) => <Chip key={r} tono="brand">{r}</Chip>)}</div>
                  </td>
                  <td className="px-3">
                    <Chip tono={ESTADO_TONO[a.estado]}>{ESTADO_ETIQUETA[a.estado]}</Chip>
                    {a.estado === 'pendiente' && a.claveVence && <div className="mt-0.5 text-xs text-muted">Vence el {fechaCorta(a.claveVence)}</div>}
                  </td>
                  <td className="px-3 text-muted">{fechaCorta(a.ultimoIngreso)}</td>
                  <td className="px-3 text-right">
                    <div className="inline-flex gap-2.5">
                      {a.estado !== 'sin_acceso' && (
                        <Btn variante="ghost" aria-label={`Cambiar roles de ${a.nombre}`} onClick={() => setDialogo({ tipo: 'roles', a })}>
                          <Pencil size={14} />
                          Roles
                        </Btn>
                      )}
                      {!yo && a.estado !== 'sin_acceso' && (
                        <Btn variante="ghost" aria-label={`Restablecer la clave de ${a.nombre}`} onClick={() => setDialogo({ tipo: 'reiniciar', a })}>
                          <KeyRound size={14} />
                          Clave
                        </Btn>
                      )}
                      {!yo && (a.estado === 'sin_acceso' ? (
                        <Btn variante="soft" aria-label={`Reactivar a ${a.nombre}`} onClick={() => setDialogo({ tipo: 'reiniciar', a })}>
                          <RotateCcw size={14} />
                          Reactivar
                        </Btn>
                      ) : (
                        <Btn variante="danger" aria-label={`Quitar el acceso a ${a.nombre}`} onClick={() => setDialogo({ tipo: 'quitar', a })}>
                          <UserMinus size={14} />
                          Quitar
                        </Btn>
                      ))}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!cargando && visibles.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Ninguna persona coincide con la búsqueda.</td></tr>
            )}
            {cargando && <tr><td colSpan={5} className="px-4 py-10 text-center"><EnCarga /></td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-sm text-muted">
        Cada persona entra con su usuario y una clave temporal que se muestra una sola vez; el sistema le pide cambiarla en el primer ingreso. Los tutores no tienen acceso.
      </p>

      {dialogo?.tipo === 'nuevo' && (
        <FormularioNuevo
          docentes={docentes}
          onClose={() => setDialogo(null)}
          onCreado={(nombre, entrega) => { terminar(null); setDialogo({ tipo: 'clave', nombre, entrega, motivo: 'nuevo' }); }}
        />
      )}
      {dialogo?.tipo === 'roles' && (
        <FormularioRoles a={dialogo.a} docentes={docentes} onClose={() => setDialogo(null)} onGuardado={(t) => { setDialogo(null); terminar(t); }} />
      )}
      {dialogo?.tipo === 'reiniciar' && (
        <ReiniciarClave
          a={dialogo.a}
          onClose={() => setDialogo(null)}
          onHecho={(entrega) => { terminar(null); setDialogo({ tipo: 'clave', nombre: dialogo.a.nombre, entrega, motivo: 'reinicio' }); }}
        />
      )}
      {dialogo?.tipo === 'quitar' && (
        <Confirmar
          titulo="Quitar el acceso"
          textoBoton="Quitar acceso"
          peligro
          onClose={() => setDialogo(null)}
          onConfirmar={async () => { await quitarAcceso(dialogo.a.id); setDialogo(null); terminar(`${dialogo.a.nombre} ya no puede entrar al sistema. Su historial se conserva y se puede reactivar.`); }}
        >
          <p>
            <b className="text-ink">{dialogo.a.nombre}</b> dejará de poder entrar. <b>No se borra nada</b>: sus registros y su historial se conservan, y puedes reactivar el acceso cuando quieras.
          </p>
        </Confirmar>
      )}
      {dialogo?.tipo === 'clave' && <ClaveEntregadaModal nombre={dialogo.nombre} entrega={dialogo.entrega} motivo={dialogo.motivo} onClose={() => setDialogo(null)} />}
    </>
  );
}

// ---------- Clave temporal: automática o escrita a mano ----------
type ModoClave = 'auto' | 'manual';

function SelectorClave({ modo, onModo, clave, onClave, error }: { modo: ModoClave; onModo: (m: ModoClave) => void; clave: string; onClave: (c: string) => void; error?: string }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium text-muted">Clave temporal</legend>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name="modo-clave" className="accent-[var(--brand)]" checked={modo === 'auto'} onChange={() => onModo('auto')} />
        Generarla automáticamente (recomendado)
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="radio" name="modo-clave" className="accent-[var(--brand)]" checked={modo === 'manual'} onChange={() => onModo('manual')} />
        Escribirla yo
      </label>
      {modo === 'manual' && (
        <Campo etiqueta="Clave temporal escrita por ti">
          <input className={inputCls} type="text" autoComplete="off" spellCheck={false} value={clave} onChange={(e) => onClave(e.target.value)} />
          <span className="mt-1 block text-xs text-muted">Mínimo 8 caracteres, con letras y números. La persona deberá cambiarla al entrar.</span>
          {error && <span className="mt-1 block text-xs text-bad-ink">{error}</span>}
        </Campo>
      )}
    </fieldset>
  );
}

function ReiniciarClave({ a, onClose, onHecho }: { a: Acceso; onClose: () => void; onHecho: (e: ClaveEntregada) => void }) {
  const [modo, setModo] = useState<ModoClave>('auto');
  const [clave, setClave] = useState('');
  const problema = modo === 'manual' ? validarClaveTemporal(clave, a.usuario ?? undefined) : null;
  return (
    <Confirmar
      titulo={a.estado === 'sin_acceso' ? 'Reactivar el acceso' : 'Restablecer la clave'}
      textoBoton={a.estado === 'sin_acceso' ? 'Reactivar y dar clave nueva' : 'Guardar clave temporal'}
      bloqueo={modo === 'manual' && clave ? problema : null}
      onClose={onClose}
      onConfirmar={async () => {
        if (modo === 'manual' && problema) throw new Error(problema);
        onHecho(await reiniciarAcceso(a.id, modo === 'manual' ? clave : undefined));
      }}
    >
      <p>
        Se dará una <b className="text-ink">clave temporal nueva</b> a <b className="text-ink">{a.nombre}</b>. La clave anterior deja de funcionar y deberá crear una propia al entrar.
      </p>
      <SelectorClave modo={modo} onModo={setModo} clave={clave} onClave={setClave} />
    </Confirmar>
  );
}

// ---------- Interruptores de roles ----------
function InterruptoresRoles({ roles, onChange }: { roles: Rol[]; onChange: (r: Rol[]) => void }) {
  return (
    <div className="grid gap-2" role="group" aria-label="Roles">
      {ROLES_ASIGNABLES.map((r) => {
        const on = roles.includes(r);
        return (
          <button
            key={r}
            type="button"
            role="switch"
            aria-checked={on}
            onClick={() => onChange(alternarRol(roles, r))}
            className={cx('flex items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition', on ? 'border-brand bg-brand-soft' : 'border-line bg-surface hover:bg-surface-2')}
          >
            <span className={cx('relative h-5 w-9 shrink-0 rounded-full transition', on ? 'bg-brand' : 'bg-line')}>
              <span className={cx('absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all', on ? 'left-[18px]' : 'left-0.5')} />
            </span>
            <span>
              <span className="block font-medium">{ROL_ETIQUETA[r]}</span>
              <span className="block text-xs text-muted">{ROL_DESCRIPCION[r]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function SelectorDocente({ valor, onChange, docentes, actualId }: { valor: string; onChange: (v: string) => void; docentes: Docente[]; actualId: string | null }) {
  const libres = docentes.filter((d) => d.activo && (d.perfilId === null || d.id === actualId));
  return (
    <Campo etiqueta="Registro de docente (para sus clases)">
      <select className={inputCls} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">Elige una opción</option>
        <option value="nuevo">Crear un registro de docente nuevo con este nombre</option>
        {libres.map((d) => <option key={d.id} value={d.id}>Usar el docente existente: {d.nombre}</option>)}
      </select>
    </Campo>
  );
}

// ---------- Nuevo acceso ----------
function FormularioNuevo({ docentes, onClose, onCreado }: { docentes: Docente[]; onClose: () => void; onCreado: (nombre: string, e: ClaveEntregada) => void }) {
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [editoUsuario, setEditoUsuario] = useState(false);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [docente, setDocente] = useState('');
  const [modoClave, setModoClave] = useState<ModoClave>('auto');
  const [claveManual, setClaveManual] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Al terminar de escribir el nombre se propone un usuario libre (se puede cambiar).
  async function proponer() {
    if (editoUsuario || !nombre.trim()) return;
    try { setUsuario(await sugerirUsuario(nombre)); } catch { /* la sugerencia es opcional */ }
  }

  async function crear() {
    const errs = validarBorradorAcceso({ nombre, usuario, roles, docente }, validarUsuario);
    if (modoClave === 'manual') {
      const pc = validarClaveTemporal(claveManual, usuario);
      if (pc) errs.clave = pc;
    }
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;
    setEnviando(true);
    setErrorServidor(null);
    try {
      const { docenteId, crearDocente } = paramsDocente(roles, docente);
      const entrega = await crearAcceso({ usuario: usuario.trim().toLowerCase(), nombre: nombre.trim(), roles: ordenarRoles(roles), docenteId, crearDocente, claveManual: modoClave === 'manual' ? claveManual : undefined });
      onCreado(nombre.trim(), entrega);
    } catch (e) {
      setErrorServidor((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Nuevo acceso" onClose={onClose} ancho="lg">
      <form onSubmit={(e) => { e.preventDefault(); void crear(); }} noValidate className="grid gap-3">
        <Campo etiqueta="Nombre de la persona (es el que verá en pantalla)">
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} onBlur={() => void proponer()} />
          {errores.nombre && <span className="mt-1 block text-xs text-bad-ink">{errores.nombre}</span>}
        </Campo>
        <Campo etiqueta="Usuario (solo para iniciar sesión)">
          <input className={inputCls} value={usuario} autoCapitalize="none" spellCheck={false} onChange={(e) => { setUsuario(e.target.value); setEditoUsuario(true); }} />
          {errores.usuario && <span className="mt-1 block text-xs text-bad-ink">{errores.usuario}</span>}
        </Campo>
        <div>
          <div className="mb-1 text-sm font-medium text-muted">Roles</div>
          <InterruptoresRoles roles={roles} onChange={setRoles} />
          {errores.roles && <span className="mt-1 block text-xs text-bad-ink">{errores.roles}</span>}
        </div>
        {roles.includes('docente') && <SelectorDocente valor={docente} onChange={setDocente} docentes={docentes} actualId={null} />}
        <SelectorClave modo={modoClave} onModo={setModoClave} clave={claveManual} onClave={setClaveManual} error={errores.clave} />
        {errorServidor && <Aviso tono="bad">{errorServidor}</Aviso>}
        <div className="flex justify-end gap-2">
          <Btn variante="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" disabled={enviando}>{enviando ? 'Creando…' : 'Crear acceso'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Cambiar roles y nombre ----------
function FormularioRoles({ a, docentes, onClose, onGuardado }: { a: Acceso; docentes: Docente[]; onClose: () => void; onGuardado: (m: string) => void }) {
  const [nombre, setNombre] = useState(a.nombre);
  const [roles, setRoles] = useState<Rol[]>(a.roles);
  const [docente, setDocente] = useState(a.docenteId ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const quitaDocente = a.roles.includes('docente') && !roles.includes('docente');

  async function guardar() {
    const problema = !nombre.trim() ? 'Escribe el nombre de la persona.' : validarRoles(roles, docente);
    if (problema) { setError(problema); return; }
    setEnviando(true);
    setError(null);
    try {
      const { docenteId, crearDocente } = paramsDocente(roles, docente);
      if (nombre.trim() !== a.nombre) await renombrarAcceso(a.id, nombre.trim());
      await cambiarRoles(a.id, ordenarRoles(roles), docenteId, crearDocente);
      onGuardado(`Se actualizaron los datos de ${nombre.trim()}.`);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={`Roles de ${a.nombre}`} onClose={onClose} ancho="lg">
      <form onSubmit={(e) => { e.preventDefault(); void guardar(); }} noValidate className="grid gap-3">
        <Campo etiqueta="Nombre (el que se ve en pantalla)">
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Campo>
        <InterruptoresRoles roles={roles} onChange={setRoles} />
        {roles.includes('docente') && <SelectorDocente valor={docente} onChange={setDocente} docentes={docentes} actualId={a.docenteId} />}
        {quitaDocente && <Aviso tono="warn">Al quitar el rol Docente, su registro de docente se conserva (con sus clases), pero deja de estar ligado a este usuario.</Aviso>}
        {error && <Aviso tono="bad">{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Btn variante="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cambios'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

// ---------- Clave temporal (se muestra una sola vez) ----------
function ClaveEntregadaModal({ nombre, entrega, motivo, onClose }: { nombre: string; entrega: ClaveEntregada; motivo: 'nuevo' | 'reinicio'; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const texto = mensajeEntrega({ nombre, usuario: entrega.usuario, clave: entrega.claveTemporal, vence: entrega.vence, direccion: window.location.origin });
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
    } catch { /* si el navegador no deja copiar, el texto está a la vista */ }
  }
  return (
    <Modal titulo={motivo === 'nuevo' ? 'Acceso creado' : 'Clave temporal nueva'} onClose={onClose} ancho="lg">
      <div className="grid gap-3 text-sm">
        <Aviso tono="warn">Esta clave <b>se muestra una sola vez</b>. Anótala o cópiala ahora y entrégasela a {nombre} en persona o por un medio privado.</Aviso>
        <div className="rounded-xl border border-line bg-surface-2 p-4">
          <div className="text-muted">Usuario</div>
          <div className="mb-3 font-mono text-lg font-semibold">{entrega.usuario}</div>
          <div className="text-muted">Clave temporal</div>
          <div className="font-mono text-lg font-semibold tracking-wide" data-testid="clave-temporal">{entrega.claveTemporal}</div>
        </div>
        <p className="text-muted">Al entrar por primera vez, el sistema le pedirá crear su propia clave. La temporal vence en 7 días.</p>
        <pre className="whitespace-pre-wrap rounded-xl border border-line bg-surface p-3 text-xs text-muted">{texto}</pre>
        <div className="flex justify-end gap-2">
          <Btn variante="ghost" onClick={() => void copiar()}><Copy size={14} />{copiado ? 'Copiado' : 'Copiar mensaje'}</Btn>
          <Btn onClick={onClose}>Listo, ya la anoté</Btn>
        </div>
      </div>
    </Modal>
  );
}
