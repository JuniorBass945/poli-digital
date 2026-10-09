import { useEffect, useState } from 'react';
import { Card, Chip, PageHeader } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { ROL_ETIQUETA } from '../lib/roles';
import { supabase } from '../lib/supabase';
import { modulosPendientes, modulosVisibles } from '../modules/registry';

const TABLAS: Array<[string, string]> = [
  ['estudiantes', 'Estudiantes'],
  ['tutores', 'Tutores'],
  ['docentes', 'Docentes'],
  ['aulas', 'Aulas'],
];

export default function Inicio() {
  const { perfil, modulosActivos } = useAuth();
  const [conteos, setConteos] = useState<Record<string, number | null>>({});

  // Cada rol cuenta solo lo que la seguridad por fila le deja ver: es la prueba visible de que funciona.
  useEffect(() => {
    let vivo = true;
    void Promise.all(
      TABLAS.map(async ([tabla]) => {
        const { count, error } = await supabase.from(tabla).select('*', { count: 'exact', head: true });
        return [tabla, error ? null : count ?? 0] as const;
      })
    ).then((pares) => vivo && setConteos(Object.fromEntries(pares)));
    return () => { vivo = false; };
  }, []);

  if (!perfil) return null;
  const activos = modulosVisibles(perfil.rol, modulosActivos).filter((m) => !m.siempre);
  const pendientes = modulosPendientes(perfil.rol, modulosActivos);

  return (
    <>
      <PageHeader titulo={`Hola, ${perfil.nombre}`} desc={`${ROL_ETIQUETA[perfil.rol]} en ${perfil.centroNombre}`} />
      <div className="grid gap-3.5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Lo que tu rol puede ver</h2>
          <p className="mb-3 text-sm text-muted">Cantidades que devuelve la base de datos para tu usuario. Cambia según el rol.</p>
          <dl className="grid grid-cols-2 gap-2">
            {TABLAS.map(([tabla, etiqueta]) => (
              <div key={tabla} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-muted">{etiqueta}</dt>
                <dd className="font-display text-2xl font-semibold">{conteos[tabla] ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-semibold">Módulos de tu centro</h2>
          <p className="mb-3 text-sm text-muted">Se activan por entregas, con una bandera por centro.</p>
          <ul className="space-y-2 text-sm">
            {activos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3">
                <span>{m.etiqueta}</span>
                <Chip tono="ok">Activo</Chip>
              </li>
            ))}
            {pendientes.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 text-muted">
                <span>{m.etiqueta}</span>
                <Chip>Entrega {m.entrega}</Chip>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
