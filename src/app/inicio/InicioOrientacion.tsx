import { Aviso, Card } from '../../ui';
import { cargarPanel14, contarAvisosPendientes } from './api';
import { EsqueletoInicio, Indicador, Seccion, Vacio, irA, useCarga } from './piezas';

export default function InicioOrientacion({ activos }: { activos: ReadonlySet<string> }) {
  const panel = useCarga(activos.has('asistencia') ? cargarPanel14 : null, 'panel14');
  const avisos = useCarga(activos.has('avisos') ? contarAvisosPendientes : null, 'avisos');

  if (!activos.has('asistencia')) {
    return <Card className="p-5 text-sm text-muted">El seguimiento de estudiantes aparecerá aquí cuando se active el módulo de asistencia en tu centro.</Card>;
  }
  if (panel.cargando) return <EsqueletoInicio />;
  if (panel.error || !panel.datos) return <Aviso tono="bad">No se pudo cargar el resumen: {panel.error}</Aviso>;
  const p = panel.datos;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador etiqueta="Estudiantes con ausencias frecuentes" valor={p.en_riesgo.length} tono={p.en_riesgo.length > 0 ? 'warn' : 'ok'} nota="3 o más días con ausencia en 2 semanas" />
        {activos.has('avisos') && (
          <Indicador etiqueta="Avisos a familias por enviar" valor={avisos.cargando ? '…' : avisos.datos ?? '—'} nota="Los envía el docente o coordinación" alHacerClic={() => irA('avisos')} />
        )}
        <Indicador etiqueta="Tardanzas en 2 semanas" valor={p.resumen.tardanzas} />
      </div>

      <Seccion titulo="Estudiantes para dar seguimiento" ayuda="Ordenados por días con ausencia. Los casos y alertas de seguimiento llegarán con el módulo de orientación.">
        {p.en_riesgo.length === 0 ? (
          <Vacio>Nadie llega al umbral en estas dos semanas.</Vacio>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {p.en_riesgo.slice(0, 8).map((r) => (
              <li key={r.estudiante_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><b className="font-medium">{r.nombre}</b> <span className="text-xs text-muted">{r.aula ?? ''} · {r.matricula}</span></span>
                <span className="text-muted">{r.dias_ausente} días con ausencia · {r.tardanzas} tardanzas</span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  );
}
