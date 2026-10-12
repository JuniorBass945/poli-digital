import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, Pencil, Search } from 'lucide-react';
import { Aviso, Btn, Campo, Card, Chip, Modal, inputCls } from '../../ui';
import { actualizarTutor, listarTutoresAdmin, registrarConsentimiento } from './apiTutores';
import { ETIQUETA_ESTADO, TONO_ESTADO, estadoWhatsapp, type EstadoWhatsapp, type TutorFila } from './estadoTutor';
import { PARENTESCOS, normalizarTelefono } from './validar';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const corta = (iso: string) => new Date(iso).toLocaleDateString('es-DO');

type Filtro = EstadoWhatsapp | 'todos';
type Dialogo = { tipo: 'editar'; t: TutorFila } | { tipo: 'consentimiento'; t: TutorFila } | null;

export default function Tutores() {
  const [tutores, setTutores] = useState<TutorFila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [dialogo, setDialogo] = useState<Dialogo>(null);

  const cargar = useCallback(async () => {
    try {
      setTutores(await listarTutoresAdmin());
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

  const terminar = (texto: string) => { setDialogo(null); setMensaje(texto); setCargando(true); void cargar(); };

  const cuenta = useMemo(() => {
    const c: Record<Filtro, number> = { todos: tutores.length, sin_telefono: 0, pendiente: 0, otorgado: 0, verificado: 0 };
    for (const t of tutores) c[estadoWhatsapp(t)]++;
    return c;
  }, [tutores]);

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return tutores.filter((t) => {
      if (filtro !== 'todos' && estadoWhatsapp(t) !== filtro) return false;
      if (!q) return true;
      const hijos = t.hijos.map((h) => `${h.nombres} ${h.apellidos} ${h.matricula}`).join(' ');
      return sinTildes(`${t.nombre} ${t.telefono ?? ''} ${hijos}`).includes(q);
    });
  }, [tutores, busqueda, filtro]);

  const FILTROS: Array<{ id: Filtro; etiqueta: string }> = [
    { id: 'todos', etiqueta: 'Todos' },
    { id: 'pendiente', etiqueta: 'Pendientes' },
    { id: 'otorgado', etiqueta: 'Sin verificar' },
    { id: 'verificado', etiqueta: 'Verificados' },
    { id: 'sin_telefono', etiqueta: 'Sin teléfono' },
  ];

  return (
    <>
      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <div role="group" aria-label="Estado de WhatsApp" className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              aria-pressed={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${filtro === f.id ? 'border-brand bg-brand-soft font-medium text-brand' : 'border-line text-muted hover:bg-surface-2'}`}
            >
              {f.etiqueta} ({cuenta[f.id]})
            </button>
          ))}
        </div>
        <Campo etiqueta="Buscar">
          <div className="relative w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={`${inputCls} pl-9`} placeholder="Tutor, teléfono o hijo" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </Campo>
      </div>

      {mensaje && <div className="mb-3"><Aviso tono="ok">{mensaje}</Aviso></div>}
      {error && <div className="mb-3"><Aviso tono="bad">{error}</Aviso></div>}

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-muted">
              <th className="px-4 py-2.5 font-medium">Tutor</th>
              <th className="px-3 font-medium">Contacto</th>
              <th className="px-3 font-medium">Hijos</th>
              <th className="px-3 font-medium">WhatsApp</th>
              <th className="px-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((t) => {
              const estado = estadoWhatsapp(t);
              return (
                <tr key={t.id} className="h-15 border-b border-line last:border-0">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{t.nombre}</div>
                    <div className="text-xs text-muted">{t.parentesco ?? 'Sin parentesco'}</div>
                  </td>
                  <td className="px-3">
                    <div>{t.telefono ?? <span className="text-muted">—</span>}</div>
                    <div className="text-xs text-muted">{t.correo ?? ''}</div>
                  </td>
                  <td className="px-3">
                    {t.hijos.length === 0 ? (
                      <span className="text-muted">Sin hijos</span>
                    ) : (
                      <>
                        {t.hijos.slice(0, 3).map((h) => (
                          <div key={h.id} className={h.activo ? '' : 'text-muted line-through'}>{h.nombres} {h.apellidos}</div>
                        ))}
                        {t.hijos.length > 3 && <div className="text-xs text-muted">y {t.hijos.length - 3} más</div>}
                      </>
                    )}
                  </td>
                  <td className="px-3">
                    <Chip tono={TONO_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Chip>
                    {t.consentimiento?.otorgadoEn && t.consentimiento.otorgado && <div className="mt-0.5 text-xs text-muted">desde {corta(t.consentimiento.otorgadoEn)}</div>}
                  </td>
                  <td className="px-3 text-right">
                    <div className="inline-flex gap-2.5">
                      <Btn variante="ghost" aria-label={`Editar a ${t.nombre}`} onClick={() => setDialogo({ tipo: 'editar', t })}>
                        <Pencil size={14} />
                        Editar
                      </Btn>
                      <Btn variante="soft" aria-label={`Consentimiento de ${t.nombre}`} onClick={() => setDialogo({ tipo: 'consentimiento', t })}>
                        <MessageCircle size={14} />
                        WhatsApp
                      </Btn>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!cargando && visibles.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">{tutores.length === 0 ? 'Todavía no hay tutores. Se crean al registrar estudiantes.' : 'Ningún tutor coincide con la búsqueda o el filtro.'}</td></tr>
            )}
            {cargando && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Cargando…</td></tr>}
          </tbody>
        </table>
      </Card>
      <p className="mt-2 text-sm text-muted">
        Los tutores se crean al registrar o importar estudiantes. Aquí corriges sus datos y anotas si aceptaron recibir mensajes por WhatsApp (obligatorio para el envío automático).
      </p>

      {dialogo?.tipo === 'editar' && <FormularioTutor tutor={dialogo.t} onClose={() => setDialogo(null)} onGuardado={terminar} />}
      {dialogo?.tipo === 'consentimiento' && <FormularioConsentimiento tutor={dialogo.t} onClose={() => setDialogo(null)} onGuardado={terminar} />}
    </>
  );
}

function FormularioTutor({ tutor, onClose, onGuardado }: { tutor: TutorFila; onClose: () => void; onGuardado: (m: string) => void }) {
  const [nombre, setNombre] = useState(tutor.nombre);
  const [parentesco, setParentesco] = useState(tutor.parentesco ?? '');
  const [telefono, setTelefono] = useState(tutor.telefono ?? '');
  const [correo, setCorreo] = useState(tutor.correo ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const errs: Record<string, string> = {};
    if (!nombre.trim()) errs.nombre = 'Escribe el nombre del tutor.';
    const tel = normalizarTelefono(telefono);
    if (!telefono.trim()) errs.telefono = 'Escribe el teléfono.';
    else if (!tel) errs.telefono = 'El teléfono debe tener 10 dígitos, por ejemplo 809-555-1234.';
    if (correo.trim() && !CORREO.test(correo.trim())) errs.correo = 'El correo no parece válido.';
    setErrores(errs);
    if (Object.keys(errs).length > 0 || !tel) return;
    setEnviando(true);
    setErrorServidor(null);
    try {
      await actualizarTutor(tutor.id, nombre.trim(), parentesco || null, tel, correo.trim() || null);
      onGuardado(`Los datos de ${nombre.trim()} fueron actualizados.`);
    } catch (e) {
      setErrorServidor((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Editar tutor" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); void guardar(); }} noValidate className="grid gap-3">
        <Campo etiqueta="Nombre del tutor">
          <input className={inputCls} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {errores.nombre && <span className="mt-1 block text-xs text-bad-ink">{errores.nombre}</span>}
        </Campo>
        <Campo etiqueta="Parentesco">
          <select className={inputCls} value={parentesco} onChange={(e) => setParentesco(e.target.value)}>
            <option value="">Sin especificar</option>
            {PARENTESCOS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </Campo>
        <Campo etiqueta="Teléfono (WhatsApp)">
          <input className={inputCls} inputMode="tel" placeholder="809-555-1234" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          {errores.telefono && <span className="mt-1 block text-xs text-bad-ink">{errores.telefono}</span>}
        </Campo>
        <Campo etiqueta="Correo (opcional)">
          <input className={inputCls} type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} />
          {errores.correo && <span className="mt-1 block text-xs text-bad-ink">{errores.correo}</span>}
        </Campo>
        {tutor.hijos.length > 1 && <p className="text-xs text-muted">Este tutor tiene {tutor.hijos.length} hijos: el cambio vale para todos.</p>}
        {errorServidor && <Aviso tono="bad">{errorServidor}</Aviso>}
        <div className="flex justify-end gap-2">
          <Btn variante="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar cambios'}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function FormularioConsentimiento({ tutor, onClose, onGuardado }: { tutor: TutorFila; onClose: () => void; onGuardado: (m: string) => void }) {
  const c = tutor.consentimiento;
  const [otorgado, setOtorgado] = useState(c?.otorgado ?? false);
  const [verificado, setVerificado] = useState(c?.verificado ?? false);
  const [evidencia, setEvidencia] = useState(c?.evidencia ?? '');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    if (otorgado && !evidencia.trim()) {
      setError('Escribe la evidencia del consentimiento, por ejemplo "formulario firmado en la matrícula".');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await registrarConsentimiento(tutor.id, otorgado, otorgado && verificado, evidencia);
      onGuardado(otorgado ? `Se registró el consentimiento de WhatsApp de ${tutor.nombre}.` : `Se anotó que ${tutor.nombre} no tiene consentimiento de WhatsApp.`);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Consentimiento de WhatsApp" onClose={onClose}>
      <div className="grid gap-3">
        <p className="text-sm text-muted">
          <b className="text-ink">{tutor.nombre}</b> · {tutor.telefono ?? 'sin teléfono'}. Anota si aceptó recibir mensajes del centro por WhatsApp. Sin este permiso no se debe usar el envío automático.
        </p>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
            checked={otorgado}
            onChange={(e) => { setOtorgado(e.target.checked); if (!e.target.checked) setVerificado(false); }}
          />
          <span>El tutor aceptó recibir mensajes por WhatsApp{c?.otorgado && c.otorgadoEn ? ` (desde ${corta(c.otorgadoEn)})` : ''}</span>
        </label>
        <label className={`flex items-start gap-2 text-sm ${otorgado ? '' : 'text-muted'}`}>
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--brand)]" checked={verificado} disabled={!otorgado} onChange={(e) => setVerificado(e.target.checked)} />
          <span>El número fue verificado (se confirmó que es de esta persona)</span>
        </label>
        <Campo etiqueta={otorgado ? 'Evidencia (obligatoria)' : 'Nota (opcional)'}>
          <textarea rows={2} className={inputCls} value={evidencia} onChange={(e) => setEvidencia(e.target.value)} placeholder="Ej.: Formulario firmado en la matrícula, 15/08/2026" />
        </Campo>
        {error && <Aviso tono="bad">{error}</Aviso>}
        <div className="flex justify-end gap-2">
          <Btn variante="ghost" onClick={onClose}>Cancelar</Btn>
          <Btn disabled={enviando} onClick={() => void guardar()}>{enviando ? 'Guardando…' : 'Guardar'}</Btn>
        </div>
      </div>
    </Modal>
  );
}
