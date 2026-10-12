import { useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { CLAVE_MINIMA, validarClaveNueva } from '../lib/acceso';
import { supabase } from '../lib/supabase';
import { Aviso, Btn, Campo, Card, inputCls } from '../ui';

// Primer ingreso (o clave restablecida por la administración): hay que elegir una clave propia.
// Mientras no se cambie, la base de datos no entrega ningún dato: esta pantalla no es la única barrera.
export default function CambiarClave() {
  const { claveTemporal, salir, recargar } = useAuth();
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  if (!claveTemporal) return null;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const problema = validarClaveNueva(nueva, repetida);
    if (problema) { setError(problema); return; }
    setEnviando(true);
    setError(null);
    const { error: errClave } = await supabase.auth.updateUser({ password: nueva });
    if (errClave) {
      setError(/different|same/i.test(errClave.message) ? 'La clave nueva no puede ser igual a la temporal.' : 'No se pudo guardar la clave. Intenta con otra.');
      setEnviando(false);
      return;
    }
    const { error: errMarca } = await supabase.rpc('marcar_clave_cambiada');
    if (errMarca) {
      setError(errMarca.message);
      setEnviando(false);
      return;
    }
    await recargar();
    setEnviando(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--side)] text-white"><KeyRound size={22} /></span>
          <div>
            <div className="font-display text-lg font-semibold leading-tight">Elige tu clave</div>
            <div className="text-xs text-muted">{claveTemporal.nombre ? `Hola, ${claveTemporal.nombre}` : 'Primer ingreso'}</div>
          </div>
        </div>
        {claveTemporal.vencida ? (
          <div className="grid gap-4">
            <Aviso tono="warn">Tu clave temporal venció. Pide a la administración del centro que te dé una nueva.</Aviso>
            <Btn variante="ghost" onClick={() => void salir()}>Salir</Btn>
          </div>
        ) : (
          <form onSubmit={guardar} className="grid gap-4" noValidate>
            <p className="text-sm text-muted">Entraste con una clave temporal. Por seguridad, crea una clave que solo tú conozcas para continuar.</p>
            <Campo etiqueta="Clave nueva">
              <input className={inputCls} type="password" autoComplete="new-password" value={nueva} onChange={(e) => setNueva(e.target.value)} />
              <span className="mt-1 block text-xs text-muted">Mínimo {CLAVE_MINIMA} caracteres, con letras y números.</span>
            </Campo>
            <Campo etiqueta="Repite la clave nueva">
              <input className={inputCls} type="password" autoComplete="new-password" value={repetida} onChange={(e) => setRepetida(e.target.value)} />
            </Campo>
            {error && <p role="alert" className="text-sm text-bad-ink">{error}</p>}
            <Btn type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar y entrar'}</Btn>
            <Btn variante="ghost" onClick={() => void salir()}>Salir</Btn>
          </form>
        )}
      </Card>
    </div>
  );
}
