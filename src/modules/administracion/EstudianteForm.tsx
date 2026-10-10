import { useEffect, useMemo, useState } from 'react';
import { Aviso, Btn, Campo, Modal, inputCls } from '../../ui';
import { cx } from '../../lib/cx';
import { actualizarEstudiante, crearEstudiante, listarTutores } from './api';
import { etiquetaAula, type Aula, type EstudianteFila, type TutorResumen } from './tipos';
import { PARENTESCOS, areaInusual, normalizarTelefono, validarEstudiante, validarTutor, type Errores } from './validar';

const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function EstudianteForm({
  aulas,
  estudiante,
  comparteTutorCon,
  onClose,
  onGuardado,
}: {
  aulas: Aula[];
  estudiante: EstudianteFila | null;
  /** Nombres de otros estudiantes que comparten el mismo tutor (solo al editar). */
  comparteTutorCon: string[];
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const editando = estudiante !== null;
  const [matricula, setMatricula] = useState(estudiante?.matricula ?? '');
  const [nombres, setNombres] = useState(estudiante?.nombres ?? '');
  const [apellidos, setApellidos] = useState(estudiante?.apellidos ?? '');
  const [fecha, setFecha] = useState(estudiante?.fechaNacimiento ?? '');
  const [aulaId, setAulaId] = useState(estudiante?.aulaId ?? '');

  const [modo, setModo] = useState<'nuevo' | 'existente'>('nuevo');
  const [tNombre, setTNombre] = useState(estudiante?.tutor?.nombre ?? '');
  const [tParentesco, setTParentesco] = useState(estudiante?.tutor?.parentesco ?? 'Madre');
  const [tTelefono, setTTelefono] = useState(estudiante?.tutor?.telefono ?? '');
  const [tCorreo, setTCorreo] = useState(estudiante?.tutor?.correo ?? '');
  const [tutores, setTutores] = useState<TutorResumen[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [elegido, setElegido] = useState<TutorResumen | null>(null);

  const [errores, setErrores] = useState<Errores>({});
  const [errorServidor, setErrorServidor] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Con tutor existente, se descarga la lista de tutores una sola vez.
  useEffect(() => {
    if (modo !== 'existente' || tutores.length > 0) return;
    listarTutores().then(setTutores).catch((e: Error) => setErrorServidor(e.message));
  }, [modo, tutores.length]);

  const coincidencias = useMemo(() => {
    const q = sinTildes(busqueda.trim());
    if (q.length < 2) return [];
    return tutores.filter((t) => sinTildes(`${t.nombre} ${t.telefono ?? ''}`).includes(q)).slice(0, 6);
  }, [busqueda, tutores]);

  const mostrarTutorEditable = editando ? estudiante.tutor !== null : modo === 'nuevo';
  const telNormalizado = normalizarTelefono(tTelefono);

  async function guardar() {
    const errs: Errores = validarEstudiante({ matricula, nombres, apellidos, aulaId });
    if (mostrarTutorEditable) Object.assign(errs, validarTutor({ nombre: tNombre, telefono: tTelefono, correo: tCorreo }));
    if (!editando && modo === 'existente' && !elegido) errs.tutorElegido = 'Busca y elige un tutor de la lista.';
    setErrores(errs);
    if (Object.keys(errs).length > 0) return;

    setEnviando(true);
    setErrorServidor(null);
    const datos = {
      matricula: matricula.trim(),
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      fechaNacimiento: fecha || null,
      aulaId,
    };
    const tutorNuevo = {
      nombre: tNombre.trim(),
      parentesco: tParentesco || null,
      telefono: telNormalizado ?? tTelefono.trim(),
      correo: tCorreo.trim() || null,
    };
    try {
      if (editando) {
        await actualizarEstudiante(estudiante.id, datos, mostrarTutorEditable ? tutorNuevo : null);
        onGuardado(`Los datos de ${datos.nombres} fueron actualizados.`);
      } else {
        await crearEstudiante(datos, modo === 'existente' && elegido ? { id: elegido.id } : tutorNuevo);
        onGuardado(`${datos.nombres} ${datos.apellidos} fue registrado y ya aparece en su aula.`);
      }
    } catch (e) {
      setErrorServidor((e as Error).message);
      setEnviando(false);
    }
  }

  const err = (k: string) => (errores[k] ? <span className="mt-1 block text-xs text-bad-ink">{errores[k]}</span> : null);

  return (
    <Modal titulo={editando ? 'Editar estudiante' : 'Nuevo estudiante'} onClose={onClose} ancho="lg">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void guardar();
        }}
        noValidate
        className="grid gap-5"
      >
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Datos del estudiante</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo etiqueta="Matrícula">
              <input className={inputCls} value={matricula} onChange={(e) => setMatricula(e.target.value)} />
              {err('matricula')}
            </Campo>
            <Campo etiqueta="Fecha de nacimiento (opcional)">
              <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </Campo>
            <Campo etiqueta="Nombres">
              <input className={inputCls} value={nombres} onChange={(e) => setNombres(e.target.value)} />
              {err('nombres')}
            </Campo>
            <Campo etiqueta="Apellidos">
              <input className={inputCls} value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
              {err('apellidos')}
            </Campo>
          </div>
          <Campo etiqueta="Aula">
            <select className={inputCls} value={aulaId} onChange={(e) => setAulaId(e.target.value)}>
              <option value="">Elige un aula</option>
              {aulas.map((a) => (
                <option key={a.id} value={a.id}>
                  {etiquetaAula(a)}
                </option>
              ))}
            </select>
            {err('aulaId')}
          </Campo>
        </section>

        <section className="grid gap-3">
          <h3 className="text-sm font-semibold">Tutor principal</h3>
          {!editando && (
            <div className="flex gap-2" role="radiogroup" aria-label="Tipo de tutor">
              {([['nuevo', 'Tutor nuevo'], ['existente', 'Tutor que ya está registrado']] as const).map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={modo === k}
                  onClick={() => setModo(k)}
                  className={cx('rounded-full border px-3 py-1 text-sm', modo === k ? 'border-brand bg-brand-soft font-medium text-brand' : 'border-line text-muted')}
                >
                  {l}
                </button>
              ))}
            </div>
          )}

          {!editando && modo === 'existente' && (
            <div className="grid gap-2">
              <Campo etiqueta="Buscar por nombre o teléfono">
                <input className={inputCls} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Escribe al menos 2 letras" />
              </Campo>
              {coincidencias.length > 0 && (
                <ul className="divide-y divide-line rounded-xl border border-line text-sm">
                  {coincidencias.map((t) => (
                    <li key={t.id}>
                      <button type="button" onClick={() => { setElegido(t); setBusqueda(''); }} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-surface-2">
                        <span>{t.nombre}</span>
                        <span className="text-xs text-muted">{t.telefono}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {elegido && (
                <div className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand">
                  Tutor elegido: <b>{elegido.nombre}</b> ({elegido.telefono})
                </div>
              )}
              {err('tutorElegido')}
            </div>
          )}

          {mostrarTutorEditable && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta="Nombre del tutor">
                <input className={inputCls} value={tNombre} onChange={(e) => setTNombre(e.target.value)} />
                {err('tutorNombre')}
              </Campo>
              <Campo etiqueta="Parentesco">
                <select className={inputCls} value={tParentesco} onChange={(e) => setTParentesco(e.target.value)}>
                  {PARENTESCOS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Campo>
              <Campo etiqueta="Teléfono (WhatsApp)">
                <input className={inputCls} inputMode="tel" placeholder="809-555-1234" value={tTelefono} onChange={(e) => setTTelefono(e.target.value)} />
                {err('tutorTelefono')}
                {!errores.tutorTelefono && telNormalizado && areaInusual(telNormalizado) && (
                  <span className="mt-1 block text-xs text-warn-ink">El código de área no es 809, 829 ni 849. Verifica el número.</span>
                )}
              </Campo>
              <Campo etiqueta="Correo (opcional)">
                <input className={inputCls} type="email" value={tCorreo} onChange={(e) => setTCorreo(e.target.value)} />
                {err('tutorCorreo')}
              </Campo>
            </div>
          )}
          {editando && comparteTutorCon.length > 0 && (
            <p className="text-xs text-muted">Este tutor también tiene a {comparteTutorCon.join(', ')}. Si cambias sus datos, cambian para todos.</p>
          )}
          {editando && !estudiante.tutor && <p className="text-sm text-muted">Este estudiante no tiene tutor registrado.</p>}
          {!editando && modo === 'nuevo' && (
            <p className="text-xs text-muted">El permiso para enviarle mensajes por WhatsApp queda pendiente hasta que el tutor lo otorgue.</p>
          )}
        </section>

        {errorServidor && <Aviso tono="bad">{errorServidor}</Aviso>}
        <div className="flex justify-end gap-2">
          <Btn variante="ghost" onClick={onClose}>
            Cancelar
          </Btn>
          <Btn type="submit" disabled={enviando}>
            {enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar estudiante'}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
