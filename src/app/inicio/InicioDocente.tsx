import { guardarClaseTrabajo } from '../../lib/claseTrabajo';
import { hoyISO } from '../../lib/fechas';
import { tonoPorcentaje } from '../../modules/asistencia/resumenPanel';
import { Aviso, Btn, Card, Chip } from '../../ui';
import { cargarPanel14, clasesDeHoy, contarAvisosPendientes, type ClaseHoy } from './api';
import { esDiaHabil, resumenSemanas, textoTendencia } from './calculos';
import { EsqueletoInicio, Indicador, Seccion, Vacio, irA, useCarga } from './piezas';

function pasarLista(c: ClaseHoy) {
  guardarClaseTrabajo(c.id);   // la clase queda elegida al abrir Asistencia
  irA('asistencia');
}

export default function InicioDocente({ activos }: { activos: ReadonlySet<string> }) {
  const clases = useCarga(activos.has('asistencia') ? clasesDeHoy : null);
  const panel = useCarga(activos.has('asistencia') ? cargarPanel14 : null, 'panel14');
  const avisos = useCarga(activos.has('avisos') ? contarAvisosPendientes : null, 'avisos');

  if (!activos.has('asistencia')) {
    return <Card className="p-5 text-sm text-muted">Tus clases del día aparecerán aquí cuando se active el módulo de asistencia en tu centro.</Card>;
  }
  if (clases.cargando) return <EsqueletoInicio />;
  if (clases.error || !clases.datos) return <Aviso tono="bad">No se pudieron cargar tus clases: {clases.error}</Aviso>;

  const hoy = hoyISO();
  const lista = [...clases.datos].sort((a, b) => Number(a.listaPasada) - Number(b.listaPasada) || a.etiqueta.localeCompare(b.etiqueta, 'es'));
  const hechas = lista.filter((c) => c.listaPasada).length;
  const semana = panel.datos ? resumenSemanas(panel.datos.por_dia, hoy) : null;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Indicador
          etiqueta="Listas pasadas hoy"
          valor={lista.length === 0 ? '—' : `${hechas} de ${lista.length}`}
          tono={lista.length > 0 && hechas === lista.length ? 'ok' : hechas < lista.length ? 'warn' : 'neutral'}
        />
        <Indicador
          etiqueta="Asistencia de tus clases"
          valor={semana?.actual.pct == null ? '—' : `${semana.actual.pct}%`}
          tono={tonoPorcentaje(semana?.actual.pct ?? null)}
          nota={semana ? `Esta semana. ${textoTendencia(semana.delta)}` : undefined}
        />
        {activos.has('avisos') && (
          <Indicador
            etiqueta="Avisos por enviar"
            valor={avisos.cargando ? '…' : avisos.datos ?? '—'}
            tono={(avisos.datos ?? 0) > 0 ? 'warn' : 'ok'}
            nota="Familias de estudiantes ausentes"
            alHacerClic={() => irA('avisos')}
          />
        )}
      </div>

      <Seccion titulo="Tus clases de hoy" ayuda={esDiaHabil(hoy) ? 'Toca "Pasar lista" para ir directo a esa clase.' : 'Hoy es fin de semana: normalmente no hay clases.'}>
        {lista.length === 0 ? (
          <Vacio>Todavía no tienes clases asignadas. Pide a administración que te asigne tus materias.</Vacio>
        ) : (
          <>
            {hechas === lista.length && esDiaHabil(hoy) && <div className="mb-3"><Aviso tono="ok">Ya pasaste lista en todas tus clases de hoy. ¡Buen trabajo!</Aviso></div>}
            <ul className="divide-y divide-line text-sm">
              {lista.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <span>
                    <b className="font-medium">{c.aula}</b> · {c.materia}
                  </span>
                  <span className="flex items-center gap-2.5">
                    {c.listaPasada ? <Chip tono="ok">Lista pasada</Chip> : <Chip tono="warn">Falta pasar lista</Chip>}
                    <Btn variante={c.listaPasada ? 'ghost' : 'primary'} aria-label={`${c.listaPasada ? 'Corregir' : 'Pasar'} lista de ${c.etiqueta}`} onClick={() => pasarLista(c)}>
                      {c.listaPasada ? 'Corregir' : 'Pasar lista'}
                    </Btn>
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Seccion>
    </div>
  );
}
