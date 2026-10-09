import { Card, PageHeader } from '../ui';

/** Se muestra cuando faltan las variables de entorno de Supabase. */
export default function Setup() {
  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <PageHeader titulo="Falta configurar Supabase" desc="La app todavía no sabe a qué proyecto conectarse." />
      <Card className="p-6 text-sm">
        <ol className="list-decimal space-y-2 pl-5">
          <li>Copia <code>.env.example</code> como <code>.env.local</code>.</li>
          <li>En Supabase, abre <b>Project Settings → API</b> y copia la URL del proyecto y la clave pública (anon o publishable).</li>
          <li>Pégalas en <code>.env.local</code> y reinicia con <code>npm run dev</code>.</li>
        </ol>
        <p className="mt-4 text-muted">Nunca uses la clave <code>service_role</code> en el frontend.</p>
      </Card>
    </div>
  );
}
