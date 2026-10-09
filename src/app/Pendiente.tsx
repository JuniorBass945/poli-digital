import { Card, Chip, PageHeader } from '../ui';
import { moduloPorId } from '../modules/registry';

/** Marcador de un módulo cuyo código aún no existe: muestra qué es y cuándo llega. */
export default function Pendiente({ id }: { id: string }) {
  const m = moduloPorId(id);
  if (!m) return null;
  return (
    <>
      <PageHeader titulo={m.etiqueta} desc={m.descripcion} />
      <Card className="p-6">
        <Chip tono="warn">En construcción</Chip>
        <p className="mt-3 text-sm text-muted">
          Este módulo se construye en la entrega <b className="text-ink">{m.entrega}</b>. La bandera ya está en la base de datos:
          cuando esté listo, se despliega y se activa para el centro sin tocar lo demás.
        </p>
      </Card>
    </>
  );
}
