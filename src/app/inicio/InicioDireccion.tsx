import { hoyISO } from '../../lib/fechas';
import { tonoPorcentaje } from '../../modules/asistencia/resumenPanel';
import { Aviso, Card } from '../../ui';
import { cx } from '../../lib/cx';
import { peoresAulas, resumenSemanas, textoTendencia } from './calculos';
import { cargarPanel14, contarAvisosPendientes } from './api';
import { BarrasDias, EsqueletoInicio, Indicador, Seccion, Vacio, irA, useCarga } from './piezas';

export default function InicioDireccion({ activos }: { activos: ReadonlySet<string> }) {
  const panel = useCarga(activos.has('asistencia') ? cargarPanel14 : null, 'panel14');
  const avisos = useCarga(activos.has('avisos') ? contarAvisosPendientes : null, 'avisos');

  if (!activos.has('asistencia')) {
    return <Card className="p-5 text-sm text-muted">El resumen de asistencia aparecerá aquí cuando se active ese módulo en tu centro.</Card>;
  }
  if (panel.cargando) return <EsqueletoInicio />;
  if (panel.error || !panel.datos) return <Aviso tono="bad">No se pudo cargar el resumen: {panel.error}</Aviso>;

  const p = panel.datos;
  if (p.resumen.total === 0) {
    return (
      <Card className="p-5 text-sm text-muted">
        Todavía no hay asistencia registrada en las últimas dos semanas. Cuando los docentes pasen lista, aquí verás la tendencia, las aulas que necesitan atención y los estudiantes en riesgo.
      </Card>
    );
  }

  const { actual, delta } = resumenSemanas(p.por_dia, hoyISO());
  const peores = peoresAulas(p.por_aula, 3);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador
          etiqueta="Asistencia esta semana"
          valor={actual.pct === null ? '—' : `${actual.pct}%`}
          tono={tonoPorcentaje(actual.pct)}
          nota={textoTendencia(delta)}
          alHacerClic={() => irA('asistencia')}
        />
        <Indicador etiqueta="Ausencias esta semana" valor={actual.ausentes} alHacerClic={() => irA('asistencia')} />
        <Indicador
          etiqueta="Estudiantes en riesgo"
          valor={p.en_riesgo.length}
          tono={p.en_riesgo.length > 0 ? 'warn' : 'ok'}
          nota="3 o más días con ausencia en 2 semanas"
          alHacerClic={() => irA('asistencia')}
        />
        {activos.has('avisos') && (
          <Indicador
            etiqueta="Avisos por enviar"
            valor={avisos.cargando ? '…' : avisos.datos ?? '—'}
            tono={(avisos.datos ?? 0) > 0 ? 'warn' : 'ok'}
            nota="Ausencias que aún no se avisan a las familias"
            alHacerClic={() => irA('avisos')}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Seccion titulo="Asistencia de las últimas 2 semanas" ayuda="Porcentaje de presentes y tardanzas por día. Verde: 90 % o más.">
          <BarrasDias dias={p.por_dia} />
        </Seccion>

        <Seccion titulo="Aulas que necesitan atención" ayuda="Las 3 con menor asistencia en 2 semanas." accion={{ texto: 'Ver el resumen', modulo: 'asistencia' }}>
          <ul className="divide-y divide-line text-sm">
            {peores.map((a) => (
              <li key={a.aula_id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="font-medium">{a.aula}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">{a.ausentes} ausencias</span>
                  <span className={cx('font-semibold', tonoPorcentaje(a.pct) === 'ok' ? 'text-ok-ink' : tonoPorcentaje(a.pct) === 'warn' ? 'text-warn-ink' : 'text-bad-ink')}>{a.pct}%</span>
                </span>
              </li>
            ))}
          </ul>
        </Seccion>
      </div>

      <Seccion titulo="Estudiantes con más ausencias" ayuda="Con 3 o más días con ausencia en 2 semanas (un día cuenta si faltó a al menos una clase)." accion={{ texto: 'Ver todos', modulo: 'asistencia' }}>
        {p.en_riesgo.length === 0 ? (
          <Vacio>Nadie llega al umbral en estas dos semanas.</Vacio>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {p.en_riesgo.slice(0, 5).map((r) => (
              <li key={r.estudiante_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span>
                  <b className="font-medium">{r.nombre}</b> <span className="text-xs text-muted">{r.aula ?? ''}</span>
                </span>
                <span className="text-muted">{r.dias_ausente} días con ausencia</span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  );
}
