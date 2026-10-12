import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight } from 'lucide-react';
import { cx } from '../../lib/cx';
import { formatoCorto } from '../../lib/fechas';
import { tonoPorcentaje } from '../../modules/asistencia/resumenPanel';
import type { PanelAsistencia } from '../../modules/asistencia/api';
import { useAuth } from '../../auth/AuthProvider';
import { Btn, Card } from '../../ui';
import { EnCarga } from '../../ui/Carga';

export type Tono = 'ok' | 'warn' | 'bad' | 'neutral';
const TEXTO: Record<Tono, string> = { ok: 'text-ok-ink', warn: 'text-warn-ink', bad: 'text-bad-ink', neutral: 'text-ink' };
const BARRA = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-line' } as const;

export const irA = (modulo: string) => { window.location.hash = `/${modulo}`; };

// Memoria de lo último que se mostró, por usuario y dato. Al volver al Inicio se ve al instante lo anterior
// y se actualiza en segundo plano ("mostrar lo viejo mientras se trae lo nuevo").
const memoria = new Map<string, { datos: unknown; hora: number }>();
const VIGENCIA_MS = 5 * 60_000;

/** Para las pruebas y para cuando haga falta empezar de cero. */
export function limpiarMemoriaInicio() {
  memoria.clear();
}

/**
 * Carga un dato asíncrono y entrega { datos, error, cargando }.
 * Con `nombre`, recuerda el último resultado (por usuario, hasta 5 minutos) y lo muestra de inmediato mientras actualiza.
 */
export function useCarga<T>(fn: (() => Promise<T>) | null, nombre?: string) {
  const { perfil } = useAuth();
  const clave = nombre && perfil ? `${perfil.id}:${nombre}` : null;

  const [estado, setEstado] = useState<{ datos: T | null; error: string | null; cargando: boolean }>(() => {
    const previo = clave ? memoria.get(clave) : undefined;
    const vigente = previo !== undefined && Date.now() - previo.hora < VIGENCIA_MS;
    return { datos: vigente ? (previo.datos as T) : null, error: null, cargando: fn !== null && !vigente };
  });

  useEffect(() => {
    if (!fn) return;
    let vivo = true;
    fn()
      .then((datos) => {
        if (clave) memoria.set(clave, { datos, hora: Date.now() });
        if (vivo) setEstado({ datos, error: null, cargando: false });
      })
      .catch((e: Error) => {
        // Si ya se estaba mostrando algo, se conserva en vez de reemplazarlo por un error.
        if (vivo) setEstado((previo) => (previo.datos !== null ? previo : { datos: null, error: e.message, cargando: false }));
      });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return estado;
}

export function Indicador({ etiqueta, valor, nota, tono = 'neutral', alHacerClic }: { etiqueta: string; valor: ReactNode; nota?: string; tono?: Tono; alHacerClic?: () => void }) {
  const contenido = (
    <>
      <div className={cx('text-2xl font-semibold', TEXTO[tono])}>{valor}</div>
      <div className="text-sm text-muted">{etiqueta}</div>
      {nota && <div className="mt-0.5 text-xs text-muted">{nota}</div>}
    </>
  );
  const clases = 'rounded-2xl border border-line bg-surface px-4 py-3 text-left';
  return alHacerClic ? (
    <button type="button" onClick={alHacerClic} className={cx(clases, 'hover:bg-surface-2')}>{contenido}</button>
  ) : (
    <div className={clases}>{contenido}</div>
  );
}

export function Seccion({ titulo, ayuda, accion, children }: { titulo: string; ayuda?: string; accion?: { texto: string; modulo: string }; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold">{titulo}</h2>
          {ayuda && <p className="text-xs text-muted">{ayuda}</p>}
        </div>
        {accion && (
          <Btn variante="ghost" onClick={() => irA(accion.modulo)}>
            {accion.texto}
            <ArrowRight size={14} />
          </Btn>
        )}
      </div>
      {children}
    </Card>
  );
}

export function BarrasDias({ dias }: { dias: PanelAsistencia['por_dia'] }) {
  if (dias.length === 0) return null;
  return (
    <>
      <div role="img" aria-label="Asistencia de los últimos días" className="flex h-32 items-end gap-1 border-b border-line">
        {dias.map((d) => (
          <div key={d.fecha} className="flex h-full min-w-[6px] flex-1 flex-col justify-end" title={`${formatoCorto(d.fecha)}: ${d.pct}% (${d.ausentes} ausentes de ${d.total} registros)`}>
            <div className={cx('rounded-t', BARRA[tonoPorcentaje(d.pct)])} style={{ height: `${Math.max(d.pct, 2)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{formatoCorto(dias[0].fecha)}</span>
        <span>{formatoCorto(dias[dias.length - 1].fecha)}</span>
      </div>
    </>
  );
}

export function Cargando() {
  return <EnCarga />;
}

/** Marcadores grises con la forma de la pantalla, para que se sienta que ya está cargando. */
export function EsqueletoInicio() {
  return (
    <div className="grid gap-4" role="status" aria-label="Cargando el resumen">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[88px] animate-pulse rounded-2xl border border-line bg-surface-2" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-52 animate-pulse rounded-2xl border border-line bg-surface-2" />
        <div className="h-52 animate-pulse rounded-2xl border border-line bg-surface-2" />
      </div>
    </div>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}
