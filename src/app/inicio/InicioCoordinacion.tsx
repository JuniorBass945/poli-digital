import { hoyISO } from '../../lib/fechas';
import { tonoPorcentaje } from '../../modules/asistencia/resumenPanel';
import { Aviso, Card } from '../../ui';
import { esDiaHabil, resumenSemanas, textoTendencia } from './calculos';
import { cargarPanel14, contarAvisosPendientes } from './api';
import { EsqueletoInicio, Indicador, Seccion, Vacio, irA, useCarga } from './piezas';

export default function InicioCoordinacion({ activos }: { activos: ReadonlySet<string> }) {
  const panel = useCarga(activos.has('asistencia') ? cargarPanel14 : null, 'panel14');
  const avisos = useCarga(activos.has('avisos') ? contarAvisosPendientes : null, 'avisos');

  if (!activos.has('asistencia')) {
    return <Card className="p-5 text-sm text-muted">El seguimiento de asistencia aparecerá aquí cuando se active ese módulo en tu centro.</Card>;
  }
  if (panel.cargando) return <EsqueletoInicio />;
  if (panel.error || !panel.datos) return <Aviso tono="bad">No se pudo cargar el resumen: {panel.error}</Aviso>;

  const p = panel.datos;
  const hoy = hoyISO();
  const { actual, delta } = resumenSemanas(p.por_dia, hoy);
  const habil = esDiaHabil(hoy);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          etiqueta="Clases sin lista hoy"
          valor={habil ? p.sin_lista_hoy.length : '—'}
          tono={habil && p.sin_lista_hoy.length > 0 ? 'warn' : 'ok'}
          nota={habil ? 'Para recordarle a los docentes' : 'Hoy no hay clases'}
          alHacerClic={() => irA('asistencia')}
        />
        {activos.has('avisos') && (
          <Indicador etiqueta="Avisos por enviar" valor={avisos.cargando ? '…' : avisos.datos ?? '—'} tono={(avisos.datos ?? 0) > 0 ? 'warn' : 'ok'} alHacerClic={() => irA('avisos')} />
        )}
        <Indicador etiqueta="Estudiantes en riesgo" valor={p.en_riesgo.length} tono={p.en_riesgo.length > 0 ? 'warn' : 'ok'} nota="3 o más días con ausencia en 2 semanas" alHacerClic={() => irA('asistencia')} />
        <Indicador etiqueta="Asistencia esta semana" valor={actual.pct === null ? '—' : `${actual.pct}%`} tono={tonoPorcentaje(actual.pct)} nota={textoTendencia(delta)} alHacerClic={() => irA('asistencia')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Clases que hoy no han pasado lista" accion={{ texto: 'Abrir Asistencia', modulo: 'asistencia' }}>
          {!habil ? (
            <Vacio>Hoy es fin de semana: no hay clases.</Vacio>
          ) : p.sin_lista_hoy.length === 0 ? (
            <Vacio>Todas las clases ya pasaron lista hoy.</Vacio>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {p.sin_lista_hoy.slice(0, 8).map((c) => (
                <li key={c.asignacion_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span><b className="font-medium">{c.aula}</b> · {c.materia}</span>
                  <span className="text-muted">{c.docente}</span>
                </li>
              ))}
              {p.sin_lista_hoy.length > 8 && <li className="py-2.5 text-xs text-muted">y {p.sin_lista_hoy.length - 8} más</li>}
            </ul>
          )}
        </Seccion>

        <Seccion titulo="Estudiantes con más ausencias" ayuda="Para dar seguimiento con las familias." accion={{ texto: 'Ver todos', modulo: 'asistencia' }}>
          {p.en_riesgo.length === 0 ? (
            <Vacio>Nadie llega al umbral en estas dos semanas.</Vacio>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {p.en_riesgo.slice(0, 5).map((r) => (
                <li key={r.estudiante_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <span><b className="font-medium">{r.nombre}</b> <span className="text-xs text-muted">{r.aula ?? ''}</span></span>
                  <span className="text-muted">{r.dias_ausente} días con ausencia</span>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      </div>
    </div>
  );
}
