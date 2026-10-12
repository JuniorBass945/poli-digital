import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { cx } from '../../lib/cx';
import { formatoCorto, hoyISO } from '../../lib/fechas';
import { Aviso, Btn, Campo, Card, Chip, inputCls } from '../../ui';
import { listarAulasFiltro, panelAsistencia, type PanelAsistencia } from './api';
import { csvRiesgo, rangoPeriodo, tonoPorcentaje, type Periodo } from './resumenPanel';

const TONO_BARRA = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad', neutral: 'bg-line' } as const;
const TONO_TEXTO = { ok: 'text-ok-ink', warn: 'text-warn-ink', bad: 'text-bad-ink', neutral: 'text-muted' } as const;

function descargarCsv(p: PanelAsistencia) {
  const blob = new Blob([csvRiesgo(p)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'estudiantes_en_riesgo.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function Resumen() {
  const { perfil } = useAuth();
  const esDocente = perfil?.rol === 'docente';
  const hoy = hoyISO();

  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [desde, setDesde] = useState(rangoPeriodo('30', hoy).desde);
  const [hasta, setHasta] = useState(hoy);
  const [aulaId, setAulaId] = useState('');
  const [umbral, setUmbral] = useState(3);
  const [aulas, setAulas] = useState<Array<{ id: string; etiqueta: string }>>([]);
  const [datos, setDatos] = useState<PanelAsistencia | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarAulasFiltro().then(setAulas).catch(() => setAulas([]));
  }, []);

  const elegirPeriodo = (p: Periodo) => {
    setPeriodo(p);
    if (p !== 'otro') {
      const r = rangoPeriodo(p, hoy);
      setDesde(r.desde);
      setHasta(r.hasta);
    }
  };

  const cargar = useCallback(async () => {
    if (!desde || !hasta || desde > hasta) {
      setError('Revisa las fechas: "Desde" no puede ser posterior a "Hasta".');
      return;
    }
    setCargando(true);
    try {
      setDatos(await panelAsistencia(desde, hasta, aulaId || null, umbral));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, aulaId, umbral]);
  useEffect(() => { void cargar(); }, [cargar]);

  const pct = datos?.resumen.pct_asistencia ?? null;
  const vacio = datos !== null && datos.resumen.total === 0;
  const maxDias = useMemo(() => datos?.por_dia.length ?? 0, [datos]);

  return (
    <>
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Campo etiqueta="Período">
          <select className={`${inputCls} w-48`} value={periodo} onChange={(e) => elegirPeriodo(e.target.value as Periodo)}>
            <option value="7">Últimos 7 días</option>
            <option value="30">Últimos 30 días</option>
            <option value="mes">Este mes</option>
            <option value="otro">Elegir fechas</option>
          </select>
        </Campo>
        {periodo === 'otro' && (
          <>
            <Campo etiqueta="Desde">
              <input type="date" className={`${inputCls} w-40`} value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
            </Campo>
            <Campo etiqueta="Hasta">
              <input type="date" className={`${inputCls} w-40`} value={hasta} min={desde} max={hoy} onChange={(e) => setHasta(e.target.value)} />
            </Campo>
          </>
        )}
        {!esDocente && (
          <Campo etiqueta="Aula">
            <select className={`${inputCls} w-56`} value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
              <option value="">Todas las aulas</option>
              {aulas.map((a) => <option key={a.id} value={a.id}>{a.etiqueta}</option>)}
            </select>
          </Campo>
        )}
        <Campo etiqueta="Riesgo desde">
          <select className={`${inputCls} w-44`} value={umbral} onChange={(e) => setUmbral(Number(e.target.value))}>
            {[2, 3, 5, 7, 10].map((n) => <option key={n} value={n}>{n} días con ausencia</option>)}
          </select>
        </Campo>
        <div className="pb-2.5 text-sm text-muted">{formatoCorto(desde)} al {formatoCorto(hasta)}</div>
      </Card>

      {error && <div className="mb-3"><Aviso tono="bad">{error}</Aviso></div>}
      {cargando && !datos && <p className="text-sm text-muted">Cargando el resumen…</p>}

      {datos && vacio && (
        <Card className="p-8 text-center text-sm text-muted">No hay asistencia registrada en este período. Cuando los docentes pasen lista, aparecerá aquí.</Card>
      )}

      {datos && !vacio && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Indicador etiqueta="Asistencia" valor={pct === null ? '—' : `${pct}%`} tono={tonoPorcentaje(pct)} />
            <Indicador etiqueta="Ausencias" valor={datos.resumen.ausentes} />
            <Indicador etiqueta="Tardanzas" valor={datos.resumen.tardanzas} />
            <Indicador etiqueta="Excusas" valor={datos.resumen.excusas} />
            <Indicador etiqueta="Listas pasadas" valor={datos.resumen.listas} />
            <Indicador etiqueta="En riesgo" valor={datos.en_riesgo.length} tono={datos.en_riesgo.length > 0 ? 'warn' : 'ok'} />
          </div>

          <Card className="p-4">
            <h2 className="mb-1 text-base font-semibold">Asistencia por día</h2>
            <p className="mb-3 text-xs text-muted">Porcentaje de presentes y tardanzas entre todos los registros de cada día. Verde: 90 % o más. Amarillo: de 80 a 90. Rojo: menos de 80.</p>
            <div role="img" aria-label="Gráfico de asistencia por día" className="flex h-36 items-end gap-1 border-b border-line">
              {datos.por_dia.map((d) => {
                const tono = tonoPorcentaje(d.pct);
                return (
                  <div key={d.fecha} className="flex h-full min-w-[6px] flex-1 flex-col justify-end" title={`${formatoCorto(d.fecha)}: ${d.pct}% (${d.ausentes} ausentes de ${d.total} registros)`}>
                    <div className={cx('rounded-t', TONO_BARRA[tono])} style={{ height: `${Math.max(d.pct, 2)}%` }} />
                  </div>
                );
              })}
            </div>
            {maxDias > 0 && (
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>{formatoCorto(datos.por_dia[0].fecha)}</span>
                <span>{formatoCorto(datos.por_dia[maxDias - 1].fecha)}</span>
              </div>
            )}
          </Card>

          <Card className="overflow-x-auto">
            <h2 className="px-4 pt-4 text-base font-semibold">Por aula</h2>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-4 py-2.5 font-medium">Aula</th>
                  <th className="px-3 text-center font-medium">Listas</th>
                  <th className="px-3 font-medium">Asistencia</th>
                  <th className="px-3 text-center font-medium">Ausencias</th>
                  <th className="px-3 text-center font-medium">Tardanzas</th>
                </tr>
              </thead>
              <tbody>
                {[...datos.por_aula].sort((a, b) => a.pct - b.pct).map((a) => {
                  const tono = tonoPorcentaje(a.pct);
                  return (
                    <tr key={a.aula_id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-medium">{a.aula}</td>
                      <td className="px-3 text-center">{a.listas}</td>
                      <td className="px-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-2"><div className={cx('h-full', TONO_BARRA[tono])} style={{ width: `${a.pct}%` }} /></div>
                          <span className={cx('font-medium', TONO_TEXTO[tono])}>{a.pct}%</span>
                        </div>
                      </td>
                      <td className="px-3 text-center">{a.ausentes}</td>
                      <td className="px-3 text-center">{a.tardanzas}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="px-4 pb-3 pt-1 text-xs text-muted">Ordenadas de menor a mayor asistencia, para ver primero las que necesitan atención.</p>
          </Card>

          <Card className="overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
              <h2 className="text-base font-semibold">Estudiantes en riesgo ({datos.en_riesgo.length})</h2>
              {datos.en_riesgo.length > 0 && (
                <Btn variante="ghost" onClick={() => descargarCsv(datos)}>
                  <Download size={14} />
                  Descargar (CSV)
                </Btn>
              )}
            </div>
            <p className="px-4 pb-2 text-xs text-muted">Con {datos.umbral} o más días con ausencia en el período (un día cuenta si faltó a al menos una clase).</p>
            {datos.en_riesgo.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted">Nadie llega al umbral en este período.</p>
            ) : (
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-muted">
                    <th className="px-4 py-2.5 font-medium">Estudiante</th>
                    <th className="px-3 font-medium">Aula</th>
                    <th className="px-3 text-center font-medium">Días con ausencia</th>
                    <th className="px-3 text-center font-medium">Tardanzas</th>
                    <th className="px-3 font-medium">Última ausencia</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.en_riesgo.map((r) => (
                    <tr key={r.estudiante_id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.nombre}</div>
                        <div className="text-xs text-muted">{r.matricula}</div>
                      </td>
                      <td className="px-3">{r.aula ?? '—'}</td>
                      <td className="px-3 text-center"><Chip tono="bad">{r.dias_ausente}</Chip></td>
                      <td className="px-3 text-center">{r.tardanzas}</td>
                      <td className="px-3">{r.ultima_ausencia ? formatoCorto(r.ultima_ausencia) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {datos && datos.sin_lista_hoy.length > 0 && (
        <Card className="mt-4 p-4">
          <h2 className="mb-1 text-base font-semibold">
            {esDocente ? 'Tus clases sin lista hoy' : 'Clases que hoy no han pasado lista'} ({datos.sin_lista_hoy.length})
          </h2>
          <ul className="divide-y divide-line text-sm">
            {datos.sin_lista_hoy.map((c) => (
              <li key={c.asignacion_id} className="flex flex-wrap justify-between gap-2 py-2">
                <span><b className="font-medium">{c.aula}</b> · {c.materia}</span>
                <span className="text-muted">{c.docente}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function Indicador({ etiqueta, valor, tono = 'neutral' }: { etiqueta: string; valor: number | string; tono?: 'ok' | 'warn' | 'bad' | 'neutral' }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2.5">
      <div className={cx('text-xl font-semibold', tono === 'neutral' ? 'text-ink' : TONO_TEXTO[tono])}>{valor}</div>
      <div className="text-xs text-muted">{etiqueta}</div>
    </div>
  );
}
