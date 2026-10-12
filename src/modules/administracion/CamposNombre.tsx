import { Campo, inputCls } from '../../ui';
import { TITULOS, type PartesNombre } from './partesNombre';

/** Título (lista), nombres, 1.er apellido y 2.º apellido (opcional). */
export default function CamposNombre({
  valor, onChange, errores = {}, alSalir, deshabilitado = false,
}: { valor: PartesNombre; onChange: (p: PartesNombre) => void; errores?: Record<string, string>; alSalir?: () => void; deshabilitado?: boolean }) {
  const set = (k: keyof PartesNombre, v: string) => onChange({ ...valor, [k]: v });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Campo etiqueta="Título (opcional)">
        <select className={inputCls} disabled={deshabilitado} value={valor.titulo} onChange={(e) => set('titulo', e.target.value)} onBlur={alSalir}>
          <option value="">Sin título</option>
          {TITULOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Nombre(s)">
        <input className={inputCls} disabled={deshabilitado} value={valor.nombres} onChange={(e) => set('nombres', e.target.value)} onBlur={alSalir} />
        {errores.nombres && <span className="mt-1 block text-xs text-bad-ink">{errores.nombres}</span>}
      </Campo>
      <Campo etiqueta="1.er apellido">
        <input className={inputCls} disabled={deshabilitado} value={valor.apellido1} onChange={(e) => set('apellido1', e.target.value)} onBlur={alSalir} />
        {errores.apellido1 && <span className="mt-1 block text-xs text-bad-ink">{errores.apellido1}</span>}
      </Campo>
      <Campo etiqueta="2.º apellido (opcional)">
        <input className={inputCls} disabled={deshabilitado} value={valor.apellido2} onChange={(e) => set('apellido2', e.target.value)} onBlur={alSalir} />
      </Campo>
    </div>
  );
}
