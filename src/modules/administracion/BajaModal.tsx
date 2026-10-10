import { useState } from 'react';
import { Aviso, Btn, Campo, Modal, inputCls } from '../../ui';
import { darDeBaja } from './api';
import type { EstudianteFila } from './tipos';
import { MOTIVOS_BAJA, validarBaja } from './validar';

export default function BajaModal({
  estudiante,
  onClose,
  onHecho,
}: {
  estudiante: EstudianteFila;
  onClose: () => void;
  onHecho: (mensaje: string) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const requiereNota = MOTIVOS_BAJA.find((m) => m.codigo === motivo)?.requiereNota ?? false;
  const problema = validarBaja(motivo, nota);

  async function confirmar() {
    if (problema) {
      setError(problema);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await darDeBaja(estudiante.id, motivo, nota);
      onHecho(`${estudiante.nombres} ${estudiante.apellidos} fue dado de baja. Su historial se conserva.`);
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo="Dar de baja al estudiante" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        <b className="text-ink">
          {estudiante.nombres} {estudiante.apellidos}
        </b>{' '}
        saldrá de las listas de asistencia, notas y avisos. <b>No se borra</b>: su historial queda guardado y la baja se puede deshacer.
      </p>
      <div className="grid gap-3">
        <Campo etiqueta="Motivo de la baja">
          <select className={inputCls} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            <option value="">Elige un motivo</option>
            {MOTIVOS_BAJA.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta={requiereNota ? 'Nota (obligatoria)' : 'Nota (opcional)'}>
          <textarea
            rows={3}
            className={inputCls}
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder={requiereNota ? 'Explica el motivo' : 'Por ejemplo, a qué centro se traslada'}
          />
        </Campo>
        {error && <Aviso tono="bad">{error}</Aviso>}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Btn variante="ghost" onClick={onClose}>
          Cancelar
        </Btn>
        <Btn variante="danger" disabled={enviando || !!problema} onClick={() => void confirmar()}>
          {enviando ? 'Guardando…' : 'Dar de baja'}
        </Btn>
      </div>
    </Modal>
  );
}
