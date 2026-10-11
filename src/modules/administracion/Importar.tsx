import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { Aviso, Btn, Card, Chip } from '../../ui';
import { importarEstudiantes } from './apiImportar';
import Confirmar from './Confirmar';
import { csvDeProblemas, filasDesdeMatriz, TITULOS, OBLIGATORIOS, type FilaImportacion, type InformeImportacion } from './importacion';
import { leerArchivoExcel } from './leerExcel';

const PASO = 100;

function descargarCsv(informe: InformeImportacion) {
  const blob = new Blob([csvDeProblemas(informe)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'filas_con_problemas.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function Importar() {
  const [nombreArchivo, setNombreArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaImportacion[]>([]);
  const [informe, setInforme] = useState<InformeImportacion | null>(null);
  const [resultado, setResultado] = useState<InformeImportacion | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [soloProblemas, setSoloProblemas] = useState(true);
  const [limite, setLimite] = useState(PASO);
  const [confirmando, setConfirmando] = useState(false);

  const reiniciar = () => {
    setNombreArchivo(null);
    setFilas([]);
    setInforme(null);
    setResultado(null);
    setError(null);
    setLimite(PASO);
  };

  async function alElegirArchivo(archivo: File | undefined) {
    if (!archivo) return;
    reiniciar();
    setNombreArchivo(archivo.name);
    setRevisando(true);
    try {
      const matriz = await leerArchivoExcel(archivo);
      const lectura = filasDesdeMatriz(matriz);
      if (lectura.faltantes.length > 0) {
        const lista = lectura.faltantes.map((c) => `"${TITULOS[c]}"`).join(', ');
        throw new Error(
          lectura.filaEncabezados === 0
            ? 'El archivo está vacío. Usa la plantilla y llena la hoja "Estudiantes".'
            : `Faltan estas columnas en la primera hoja: ${lista}. Usa la plantilla para no equivocarte con los títulos.`
        );
      }
      if (lectura.filas.length === 0) throw new Error('El archivo no tiene estudiantes debajo de los títulos.');
      setFilas(lectura.filas);
      const rev = await importarEstudiantes(lectura.filas, true);
      setInforme(rev);
      setSoloProblemas(rev.errores + rev.advertencias > 0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRevisando(false);
    }
  }

  async function importar() {
    const final = await importarEstudiantes(filas, false);
    setConfirmando(false);
    setResultado(final);
    setInforme(null);
    setFilas([]);
  }

  const visibles = useMemo(() => {
    if (!informe) return [];
    return informe.filas.filter((f) => !soloProblemas || f.estado !== 'ok');
  }, [informe, soloProblemas]);

  return (
    <div className="grid gap-4">
      <Card className="p-4">
        <h2 className="mb-1 text-base font-semibold">1. Descarga la plantilla</h2>
        <p className="mb-3 text-sm text-muted">
          Llena una fila por estudiante. Las columnas obligatorias son: {OBLIGATORIOS.map((c) => TITULOS[c]).join(', ')}. Antes de importar, las aulas deben existir en la pestaña Aulas.
        </p>
        <a
          href="/plantilla_importacion_estudiantes.xlsx"
          download
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium hover:bg-surface-2"
        >
          <Download size={16} />
          Descargar plantilla de Excel
        </a>
      </Card>

      <Card className="p-4">
        <h2 className="mb-1 text-base font-semibold">2. Elige tu archivo</h2>
        <p className="mb-3 text-sm text-muted">Aquí solo se revisa: no se guarda nada hasta que lo confirmes en el paso 3.</p>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink hover:opacity-90">
          <Upload size={16} />
          {nombreArchivo ? 'Elegir otro archivo' : 'Elegir archivo de Excel (.xlsx)'}
          <input
            type="file"
            accept=".xlsx"
            aria-label="Archivo de Excel con los estudiantes"
            className="sr-only"
            onChange={(e) => {
              void alElegirArchivo(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {nombreArchivo && (
          <span className="ml-3 inline-flex items-center gap-1.5 text-sm text-muted">
            <FileSpreadsheet size={15} />
            {nombreArchivo}
          </span>
        )}
        {revisando && <p className="mt-3 text-sm text-muted">Revisando el archivo…</p>}
        {error && <div className="mt-3"><Aviso tono="bad">{error}</Aviso></div>}
      </Card>

      {informe && (
        <Card className="p-4">
          <h2 className="mb-3 text-base font-semibold">3. Revisa y confirma</h2>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Dato valor={informe.total} etiqueta="Filas leídas" />
            <Dato valor={informe.ok} etiqueta="Listas" tono="ok" />
            <Dato valor={informe.advertencias} etiqueta="Con advertencia" tono="warn" />
            <Dato valor={informe.errores} etiqueta="Con error (se omiten)" tono="bad" />
            <Dato valor={informe.tutores_nuevos} etiqueta="Tutores nuevos" />
          </div>
          <p className="mb-3 text-sm text-muted">
            Se registrarían <b className="text-ink">{informe.importados}</b> estudiantes ({informe.tutores_nuevos} tutores nuevos y {informe.tutores_reutilizados} que ya existían o se repiten en el archivo).
            {informe.errores > 0 && ' Las filas con error no se importan: corrígelas en el Excel y vuelve a subirlo, o impórtalas después.'}
          </p>

          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--brand)]" checked={soloProblemas} onChange={(e) => { setSoloProblemas(e.target.checked); setLimite(PASO); }} />
              Mostrar solo las filas con problemas
            </label>
            {informe.errores + informe.advertencias > 0 && (
              <Btn variante="ghost" onClick={() => descargarCsv(informe)}>
                <Download size={14} />
                Descargar filas con problemas (CSV)
              </Btn>
            )}
            <Btn className="ml-auto" disabled={informe.importados === 0} onClick={() => setConfirmando(true)}>
              Importar {informe.importados} estudiantes
            </Btn>
          </div>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-muted">
                  <th className="px-3 py-2 font-medium">Fila</th>
                  <th className="px-3 font-medium">Estudiante</th>
                  <th className="px-3 font-medium">Aula</th>
                  <th className="px-3 font-medium">Tutor</th>
                  <th className="px-3 font-medium">Estado</th>
                  <th className="px-3 font-medium">Detalle</th>
                </tr>
              </thead>
              <tbody>
                {visibles.slice(0, limite).map((f) => (
                  <tr key={f.fila} className="border-b border-line last:border-0 align-top">
                    <td className="px-3 py-2 text-muted">{f.fila}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{f.estudiante || '—'}</div>
                      <div className="text-xs text-muted">{f.matricula}</div>
                    </td>
                    <td className="px-3 py-2">{f.aula || <span className="text-muted">—</span>}</td>
                    <td className="px-3 py-2">{f.tutor || '—'}</td>
                    <td className="px-3 py-2">
                      {f.estado === 'ok' && <Chip tono="ok">Lista</Chip>}
                      {f.estado === 'advertencia' && <Chip tono="warn">Advertencia</Chip>}
                      {f.estado === 'error' && <Chip tono="bad">Error</Chip>}
                    </td>
                    <td className="px-3 py-2 text-muted">{f.mensajes.length ? f.mensajes.join(' ') : f.accion}</td>
                  </tr>
                ))}
                {visibles.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No hay filas con problemas. Todo se ve bien.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {visibles.length > limite && (
            <div className="mt-2 text-right">
              <Btn variante="ghost" onClick={() => setLimite(limite + PASO)}>Mostrar más</Btn>
            </div>
          )}
        </Card>
      )}

      {resultado && (
        <Card className="p-4">
          <Aviso tono="ok">
            Importación terminada: <b>{resultado.importados}</b> estudiantes registrados y {resultado.tutores_nuevos} tutores nuevos.
            {resultado.errores > 0 && ` Se omitieron ${resultado.errores} filas con error.`} Ya puedes verlos en la pestaña Estudiantes.
          </Aviso>
          <div className="mt-3 flex gap-2">
            {resultado.errores + resultado.advertencias > 0 && (
              <Btn variante="ghost" onClick={() => descargarCsv(resultado)}>
                <Download size={14} />
                Descargar filas con problemas (CSV)
              </Btn>
            )}
            <Btn variante="soft" onClick={reiniciar}>Importar otro archivo</Btn>
          </div>
        </Card>
      )}

      {confirmando && informe && (
        <Confirmar
          titulo="Confirmar la importación"
          textoBoton={`Importar ${informe.importados}`}
          onClose={() => setConfirmando(false)}
          onConfirmar={importar}
        >
          <p>
            Se registrarán <b className="text-ink">{informe.importados} estudiantes</b> con sus tutores y su matrícula en el aula indicada.
            {informe.errores > 0 && ` Las ${informe.errores} filas con error se omitirán.`} Todo se guarda junto: si algo falla, no se guarda nada.
          </p>
          <p>Después podrás corregir cualquier dato desde la pestaña Estudiantes.</p>
        </Confirmar>
      )}
    </div>
  );
}

function Dato({ valor, etiqueta, tono }: { valor: number; etiqueta: string; tono?: 'ok' | 'warn' | 'bad' }) {
  const color = tono === 'ok' ? 'text-ok-ink' : tono === 'warn' ? 'text-warn-ink' : tono === 'bad' ? 'text-bad-ink' : 'text-ink';
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
      <div className={`text-xl font-semibold ${color}`}>{valor}</div>
      <div className="text-xs text-muted">{etiqueta}</div>
    </div>
  );
}
