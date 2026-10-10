import { useState, type ReactNode } from 'react';
import { Aviso, Btn, Modal } from '../../ui';

/** Cuadro de confirmación simple. Si `bloqueo` tiene texto, la acción no se puede hacer y se explica por qué. */
export default function Confirmar({
  titulo,
  children,
  textoBoton,
  peligro = false,
  bloqueo,
  onClose,
  onConfirmar,
}: {
  titulo: string;
  children: ReactNode;
  textoBoton: string;
  peligro?: boolean;
  bloqueo?: string | null;
  onClose: () => void;
  onConfirmar: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmar() {
    setEnviando(true);
    setError(null);
    try {
      await onConfirmar();
    } catch (e) {
      setError((e as Error).message);
      setEnviando(false);
    }
  }

  return (
    <Modal titulo={titulo} onClose={onClose}>
      <div className="grid gap-3 text-sm text-muted">{children}</div>
      {bloqueo && <div className="mt-3"><Aviso tono="warn">{bloqueo}</Aviso></div>}
      {error && <div className="mt-3"><Aviso tono="bad">{error}</Aviso></div>}
      <div className="mt-4 flex justify-end gap-2">
        <Btn variante="ghost" onClick={onClose}>
          Cancelar
        </Btn>
        <Btn variante={peligro ? 'danger' : 'primary'} disabled={enviando || !!bloqueo} onClick={() => void confirmar()}>
          {enviando ? 'Guardando…' : textoBoton}
        </Btn>
      </div>
    </Modal>
  );
}
