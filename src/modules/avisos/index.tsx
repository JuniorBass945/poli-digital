import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, MessageCircle, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { enlaceWhatsapp } from '../../lib/whatsapp';
import { formatoCorto } from '../../lib/fechas';
import { Aviso as Alerta, Btn, Campo, Card, Chip, Modal, PageHeader, inputCls } from '../../ui';
import { gestionarAviso, listarAvisos, type Aviso, type EstadoAviso } from './api';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const FILTROS: Array<{ id: EstadoAviso | 'todos'; etiqueta: string }> = [
  { id: 'pendiente', etiqueta: 'Pendientes' },
  { id: 'enviado', etiqueta: 'Enviados' },
  { id: 'omitido', etiqueta: 'Omitidos' },
  { id: 'cancelado', etiqueta: 'Cancelados' },
  { id: 'todos', etiqueta: 'Todos' },
];

const TONO: Record<EstadoAviso, 'warn' | 'ok' | 'neutral'> = { pendiente: 'warn', enviado: 'ok', omitido: 'neutral', cancelado: 'neutral' };
const ETIQUETA: Record<EstadoAviso, string> = { pendiente: 'Pendiente', enviado: 'Enviado', omitido: 'Omitido', cancelado: 'Cancelado' };

export default function Avisos() {
  const { perfil } = useAuth();
  const puedeGestionar = perfil?.rol === 'docente' || perfil?.rol === 'coordinacion' || perfil?.rol === 'admin';

  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoAviso | 'todos'>('pendiente');
  const [busqueda, setBusqueda] = useState('');
  const [omitiendo, setOmitiendo] = useState<Aviso | null>(null);
  const [notaOmitir, setNotaOmitir] = useState('');

  const cargar = useCallback(async () => {
    try {
      setAvisos(await listarAvisos());
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cuenta = useMemo(() => {
    const c: Record<string, number> = { todos: avisos.length };
    for (const a of avisos) c[a.estado] = (c[a.estado] ?? 0) + 1;
    return c;
  }, [avisos]);

  const visibles = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    return avisos.filter((a) => {
      if (filtro !== 'todos' && a.estado !== filtro) return false;
      if (!q) return true;
      return sinTildes(`${a.estudiante?.nombres ?? ''} ${a.estudiante?.apellidos ?? ''} ${a.estudiante?.matricula ?? ''} ${a.tutor?.nombre ?? ''}`).includes(q);
    });
  }, [avisos, filtro, busqueda]);

  async function cambiar(a: Aviso, estado: 'pendiente' | 'enviado' | 'omitido', nota?: string, texto?: string) {
    try {
      await gestionarAviso(a.id, estado, nota);
      setError(null);
      setMensaje(texto ?? null);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader titulo="Avisos a tutores" desc="Avisos de ausencia preparados al pasar lista. Se envían con un enlace de WhatsApp que abre el mensaje ya escrito." />

      <div className="mb-3.5 flex flex-wrap items-end gap-3">
        <div role="tablist" aria-label="Estado del aviso" className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filtro === f.id}
              onClick={() => setFiltro(f.id)}
              className={`rounded-full border px-3 py-1.5 text-sm ${filtro === f.id ? 'border-brand bg-brand-soft font-medium text-brand' : 'border-line text-muted hover:bg-surface-2'}`}
            >
              {f.etiqueta} ({cuenta[f.id] ?? 0})
            </button>
          ))}
        </div>
        <Campo etiqueta="Buscar">
          <div className="relative w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className={`${inputCls} pl-9`} placeholder="Estudiante o tutor" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
        </Campo>
      </div>

      {mensaje && <div className="mb-3"><Alerta tono="ok">{mensaje}</Alerta></div>}
      {error && <div className="mb-3"><Alerta tono="bad">{error}</Alerta></div>}

      {cargando ? (
        <p className="text-sm text-muted">Cargando avisos…</p>
      ) : visibles.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">
          {avisos.length === 0 ? 'Todavía no hay avisos. Aparecen aquí cuando pasas lista y hay estudiantes ausentes.' : 'No hay avisos con ese filtro.'}
        </Card>
      ) : (
        <div className="grid gap-3">
          {visibles.map((a) => {
            const enlace = enlaceWhatsapp(a.tutor?.telefono, a.texto);
            return (
              <Card key={a.id} className="p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{a.estudiante ? `${a.estudiante.apellidos}, ${a.estudiante.nombres}` : 'Estudiante'}</div>
                    <div className="text-xs text-muted">
                      {a.estudiante?.matricula} · Ausencia del {formatoCorto(a.fecha)}
                    </div>
                  </div>
                  <Chip tono={TONO[a.estado]}>{ETIQUETA[a.estado]}</Chip>
                </div>
                <div className="mb-2 text-sm">
                  <span className="text-muted">Tutor: </span>
                  {a.tutor ? `${a.tutor.nombre}${a.tutor.parentesco ? ` (${a.tutor.parentesco})` : ''}` : '—'}
                  {' · '}
                  {a.tutor?.telefono ? a.tutor.telefono : <Chip tono="bad">Sin teléfono</Chip>}
                </div>
                <p className="mb-3 whitespace-pre-wrap rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{a.texto}</p>
                {a.nota && <p className="mb-2 text-xs text-muted">Nota: {a.nota}</p>}
                {a.estado === 'cancelado' && <p className="text-xs text-muted">Se canceló porque el estudiante ya no figura ausente.</p>}

                {puedeGestionar && a.estado === 'pendiente' && (
                  <div className="flex flex-wrap gap-2.5">
                    {enlace ? (
                      <a
                        href={enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void cambiar(a, 'enviado', undefined, 'Se abrió WhatsApp y el aviso quedó como enviado. Si no lo enviaste, usa "Volver a pendiente".')}
                        className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:opacity-90"
                      >
                        <MessageCircle size={16} />
                        Enviar por WhatsApp
                      </a>
                    ) : (
                      <Btn disabled title="El tutor no tiene un teléfono válido">
                        <MessageCircle size={16} />
                        Enviar por WhatsApp
                      </Btn>
                    )}
                    <Btn variante="ghost" onClick={() => { setOmitiendo(a); setNotaOmitir(''); }}>
                      <Ban size={16} />
                      Omitir
                    </Btn>
                  </div>
                )}
                {puedeGestionar && (a.estado === 'enviado' || a.estado === 'omitido') && (
                  <Btn variante="ghost" onClick={() => void cambiar(a, 'pendiente', undefined, 'El aviso volvió a pendiente.')}>
                    <RotateCcw size={16} />
                    Volver a pendiente
                  </Btn>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {omitiendo && (
        <Modal titulo="Omitir aviso" onClose={() => setOmitiendo(null)}>
          <p className="mb-3 text-sm text-muted">
            No se enviará el aviso de <b className="text-ink">{omitiendo.estudiante?.nombres} {omitiendo.estudiante?.apellidos}</b>. Puedes dejar una nota (por ejemplo, "ya hablé con la familia").
          </p>
          <Campo etiqueta="Nota (opcional)">
            <textarea rows={2} className={inputCls} value={notaOmitir} onChange={(e) => setNotaOmitir(e.target.value)} />
          </Campo>
          <div className="mt-4 flex justify-end gap-2">
            <Btn variante="ghost" onClick={() => setOmitiendo(null)}>Cancelar</Btn>
            <Btn onClick={() => { const a = omitiendo; setOmitiendo(null); void cambiar(a, 'omitido', notaOmitir, 'El aviso quedó como omitido.'); }}>Omitir aviso</Btn>
          </div>
        </Modal>
      )}
    </>
  );
}
