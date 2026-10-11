import { useState } from 'react';
import { MessageCircle, SkipForward } from 'lucide-react';
import { enlaceWhatsapp } from '../../lib/whatsapp';
import { formatoCorto } from '../../lib/fechas';
import { Aviso as Alerta, Btn, Modal } from '../../ui';
import type { Aviso } from './api';

/**
 * Envío seguido: recorre los avisos pendientes uno tras otro. Cada clic en "Abrir WhatsApp"
 * abre el chat con el mensaje escrito, marca el aviso como enviado y pasa al siguiente.
 * (WhatsApp exige pulsar "Enviar" en cada chat: el envío masivo real llega con la API en R2.)
 */
export default function EnvioSeguido({
  cola,
  onEnviado,
  onClose,
}: {
  cola: Aviso[];
  onEnviado: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [indice, setIndice] = useState(0);
  const [enviados, setEnviados] = useState(0);
  const [saltados, setSaltados] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const terminado = indice >= cola.length;
  const actual = terminado ? null : cola[indice];
  const enlace = actual ? enlaceWhatsapp(actual.tutor?.telefono, actual.texto) : null;

  async function alAbrir() {
    if (!actual) return;
    try {
      await onEnviado(actual.id);
      setError(null);
      setEnviados((n) => n + 1);
      setIndice((i) => i + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Modal titulo="Envío seguido de avisos" onClose={onClose} ancho="lg">
      {terminado ? (
        <div className="grid gap-3">
          <Alerta tono="ok">
            Listo. {enviados} {enviados === 1 ? 'aviso marcado como enviado' : 'avisos marcados como enviados'}
            {saltados > 0 ? ` y ${saltados} saltado${saltados === 1 ? '' : 's'} (siguen pendientes)` : ''}.
          </Alerta>
          <p className="text-sm text-muted">Si alguno no llegaste a enviarlo en WhatsApp, búscalo en la pestaña Enviados y pulsa "Volver a pendiente".</p>
          <div className="flex justify-end">
            <Btn onClick={onClose}>Cerrar</Btn>
          </div>
        </div>
      ) : (
        actual && (
          <div className="grid gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium">Aviso {indice + 1} de {cola.length}</span>
                <span className="text-muted">{enviados} enviados · {saltados} saltados</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuemin={0} aria-valuemax={cola.length} aria-valuenow={indice}>
                <div className="h-full bg-brand" style={{ width: `${(indice / cola.length) * 100}%` }} />
              </div>
            </div>

            <div>
              <div className="font-medium">
                {actual.estudiante ? `${actual.estudiante.apellidos}, ${actual.estudiante.nombres}` : 'Estudiante'}
              </div>
              <div className="text-xs text-muted">Ausencia del {formatoCorto(actual.fecha)}</div>
              <div className="mt-1 text-sm">
                <span className="text-muted">Tutor: </span>
                {actual.tutor ? `${actual.tutor.nombre}${actual.tutor.parentesco ? ` (${actual.tutor.parentesco})` : ''}` : '—'} · {actual.tutor?.telefono}
              </div>
            </div>
            <p className="whitespace-pre-wrap rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{actual.texto}</p>

            {error && <Alerta tono="bad">{error}</Alerta>}

            <p className="text-xs text-muted">
              Al pulsar el botón se abre WhatsApp en otra pestaña con el mensaje escrito. Pulsa <b>Enviar</b> allí, vuelve a esta pestaña y sigue con el siguiente.
            </p>
            <div className="flex flex-wrap justify-end gap-2.5">
              <Btn variante="ghost" onClick={() => { setSaltados((n) => n + 1); setIndice((i) => i + 1); }}>
                <SkipForward size={16} />
                Saltar este aviso
              </Btn>
              {enlace && (
                <a
                  href={enlace}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void alAbrir()}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:opacity-90"
                >
                  <MessageCircle size={16} />
                  Abrir WhatsApp y pasar al siguiente
                </a>
              )}
            </div>
          </div>
        )
      )}
    </Modal>
  );
}
