import { AuthProvider, useAuth } from '../auth/AuthProvider';
import { entornoListo } from '../lib/env';
import { Btn, Card } from '../ui';
import { CargaGlobal, EnCarga } from '../ui/Carga';
import Login from './Login';
import Setup from './Setup';
import Shell from './Shell';

function Contenido() {
  const { cargando, sesion, perfil, error, salir, recargar } = useAuth();
  if (cargando) return <div className="p-8"><EnCarga /></div>;
  if (!sesion) return <Login />;
  if (!perfil) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <Card className="p-6 text-sm">
          <h1 className="mb-2 text-lg font-semibold">Tu usuario aún no tiene acceso</h1>
          <p className="text-muted">
            {error ?? 'Tu cuenta existe, pero todavía no está asignada a un centro y a un rol. Pídele a la administración que la configure.'}
          </p>
          <div className="mt-4 flex gap-2">
            <Btn variante="soft" onClick={() => void recargar()}>Reintentar</Btn>
            <Btn variante="ghost" onClick={() => void salir()}>Salir</Btn>
          </div>
        </Card>
      </div>
    );
  }
  return <Shell />;
}

export default function App() {
  if (!entornoListo) return <Setup />;
  return (
    <AuthProvider>
      <CargaGlobal />
      <Contenido />
    </AuthProvider>
  );
}
