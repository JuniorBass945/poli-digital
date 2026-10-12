import { Aviso, Btn, Card, Chip } from '../../ui';
import { pendientesDatos, type PendientesDatos } from './api';
import { EsqueletoInicio, Indicador, Seccion, irA, useCarga } from './piezas';

interface Pendiente {
  clave: keyof PendientesDatos;
  etiqueta: string;
  efecto: string;
  tono: 'bad' | 'warn';
}

const PENDIENTES: Pendiente[] = [
  { clave: 'estudiantes_sin_tutor', etiqueta: 'Estudiantes sin tutor', efecto: 'No se les puede avisar cuando faltan.', tono: 'bad' },
  { clave: 'estudiantes_sin_aula', etiqueta: 'Estudiantes sin aula', efecto: 'No aparecen en ninguna lista de asistencia.', tono: 'bad' },
  { clave: 'tutores_sin_telefono', etiqueta: 'Tutores sin teléfono', efecto: 'No se les pueden enviar mensajes.', tono: 'bad' },
  { clave: 'aulas_sin_materias', etiqueta: 'Aulas sin materias asignadas', efecto: 'Nadie puede pasar lista en ellas.', tono: 'warn' },
  { clave: 'docentes_sin_clases', etiqueta: 'Docentes sin clases', efecto: 'Todavía no tienen materias asignadas.', tono: 'warn' },
  { clave: 'tutores_sin_consentimiento', etiqueta: 'Tutores sin consentimiento de WhatsApp', efecto: 'Se necesita para el envío automático.', tono: 'warn' },
];

export default function InicioAdmin() {
  const { datos, error, cargando } = useCarga(pendientesDatos);
  if (cargando) return <EsqueletoInicio />;
  if (error || !datos) return <Aviso tono="bad">No se pudo cargar el resumen: {error}</Aviso>;

  const conPendientes = PENDIENTES.filter((p) => datos[p.clave] > 0);

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador etiqueta="Estudiantes activos" valor={datos.estudiantes_activos} alHacerClic={() => irA('administracion')} />
        <Indicador etiqueta="Tutores" valor={datos.tutores} alHacerClic={() => irA('administracion')} />
        <Indicador etiqueta="Docentes" valor={datos.docentes} alHacerClic={() => irA('administracion')} />
        <Indicador etiqueta="Aulas" valor={datos.aulas} alHacerClic={() => irA('administracion')} />
      </div>

      <Seccion titulo="Pendientes de datos" ayuda="Lo que falta completar para que el sistema funcione bien en el día a día.">
        {conPendientes.length === 0 ? (
          <Aviso tono="ok">Todo en orden: no hay datos pendientes por completar.</Aviso>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {conPendientes.map((p) => (
              <li key={p.clave} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                <span>
                  <b className="font-medium">{p.etiqueta}</b>
                  <span className="block text-xs text-muted">{p.efecto}</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <Chip tono={p.tono}>{datos[p.clave]}</Chip>
                  <Btn variante="ghost" aria-label={`Revisar: ${p.etiqueta}`} onClick={() => irA('administracion')}>Revisar</Btn>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
      <Card className="p-4 text-xs text-muted">Todas las cifras cuentan solo registros activos. Los estudiantes y docentes dados de baja no aparecen como pendientes.</Card>
    </div>
  );
}
