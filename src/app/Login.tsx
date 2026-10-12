import { useState, type FormEvent } from 'react';
import { GraduationCap } from 'lucide-react';
import { Btn, Campo, Card, inputCls } from '../ui';
import { credencialAEmail } from '../lib/acceso';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email: credencialAEmail(usuario), password: clave });
    if (err) setError('Usuario o contraseña incorrectos.');
    setEnviando(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--side)] text-white">
            <GraduationCap size={22} />
          </span>
          <div>
            <div className="font-display text-lg font-semibold leading-tight">Poli Digital</div>
            <div className="text-xs text-muted">Gestión del centro educativo</div>
          </div>
        </div>
        <form onSubmit={entrar} className="grid gap-4">
          <Campo etiqueta="Usuario">
            <input className={inputCls} type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </Campo>
          <Campo etiqueta="Contraseña">
            <input className={inputCls} type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
          </Campo>
          {error && <p role="alert" className="text-sm text-bad-ink">{error}</p>}
          <Btn type="submit" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</Btn>
        </form>
      </Card>
    </div>
  );
}
