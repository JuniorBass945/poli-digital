import { useEffect, useState, useSyncExternalStore } from 'react';
import { actividad } from '../lib/actividad';
import { cx } from '../lib/cx';

/** Círculo que gira. Respeta la preferencia de "reducir movimiento" del sistema. */
export function Spinner({ tamano = 18, className }: { tamano?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx('inline-block shrink-0 animate-spin rounded-full border-2 border-brand border-t-transparent motion-reduce:animate-none', className)}
      style={{ width: tamano, height: tamano }}
    />
  );
}

/** Texto de carga con su círculo, para usar donde antes decía solo "Cargando…". */
export function EnCarga({ texto = 'Cargando…', className }: { texto?: string; className?: string }) {
  return (
    <span role="status" className={cx('inline-flex items-center gap-2 text-sm text-muted', className)}>
      <Spinner />
      {texto}
    </span>
  );
}

const ESTILO = `
@keyframes poli-deslizar { 0% { transform: translateX(-120%); } 100% { transform: translateX(320%); } }
.poli-barra { animation: poli-deslizar 1.1s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .poli-barra { animation: none; width: 100%; opacity: .6; } }
`;

const ESPERA_BARRA_MS = 150;     // las peticiones instantáneas no muestran nada (evita parpadeos)
const ESPERA_AVISO_MS = 1200;    // si tarda, además aparece el aviso con texto
const SALIDA_MS = 250;           // la animación se queda un momento para no cortarse de golpe

/**
 * Animación de carga de toda la aplicación: una barra fina arriba que se desliza mientras haya peticiones a la
 * base de datos, y, si tardan más de un segundo, un aviso "Cargando…" abajo a la derecha. Se coloca una sola vez.
 */
export function CargaGlobal() {
  const ocupado = useSyncExternalStore(actividad.suscribir, () => actividad.contar() > 0, () => false);
  const [barra, setBarra] = useState(false);
  const [aviso, setAviso] = useState(false);

  useEffect(() => {
    if (!ocupado) {
      const t = setTimeout(() => { setBarra(false); setAviso(false); }, SALIDA_MS);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setBarra(true), ESPERA_BARRA_MS);
    const t2 = setTimeout(() => setAviso(true), ESPERA_AVISO_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [ocupado]);

  return (
    <>
      <style>{ESTILO}</style>
      <div aria-hidden="true" className={cx('pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden transition-opacity duration-200', barra ? 'opacity-100' : 'opacity-0')}>
        <div className="poli-barra h-full w-1/3 rounded-full bg-brand" data-testid="barra-carga" />
      </div>
      {aviso && (
        <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[70] flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-2 text-sm shadow-lg">
          <Spinner />
          Cargando…
        </div>
      )}
    </>
  );
}
