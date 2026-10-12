import { useEffect, useState } from 'react';
import { Card } from '../../ui';
import { supabase } from '../../lib/supabase';

const TABLAS: Array<[string, string]> = [
  ['estudiantes', 'Estudiantes'],
  ['tutores', 'Tutores'],
  ['docentes', 'Docentes'],
  ['aulas', 'Aulas'],
];

/** Vista básica para los roles que todavía no tienen una portada propia. */
export default function InicioGeneral() {
  const [conteos, setConteos] = useState<Record<string, number | null>>({});

  // Cada rol cuenta solo lo que la seguridad por fila le deja ver.
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

  return (
    <Card className="p-5">
      <h2 className="text-base font-semibold">Lo que tu rol puede ver</h2>
      <p className="mb-3 text-sm text-muted">Cantidades que devuelve la base de datos para tu usuario. Cambia según el rol.</p>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TABLAS.map(([tabla, etiqueta]) => (
          <div key={tabla} className="rounded-xl bg-surface-2 px-3 py-2.5">
            <dt className="text-xs text-muted">{etiqueta}</dt>
            <dd className="font-display text-2xl font-semibold">{conteos[tabla] ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
