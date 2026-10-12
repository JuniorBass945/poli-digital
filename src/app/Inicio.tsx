import { Card, Chip, PageHeader } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { ROL_ETIQUETA } from '../lib/roles';
import { modulosPendientes, modulosVisibles } from '../modules/registry';
import InicioAdmin from './inicio/InicioAdmin';
import InicioCoordinacion from './inicio/InicioCoordinacion';
import InicioDireccion from './inicio/InicioDireccion';
import InicioDocente from './inicio/InicioDocente';
import InicioGeneral from './inicio/InicioGeneral';
import InicioOrientacion from './inicio/InicioOrientacion';

// Pantalla de inicio: cada rol ve primero lo que le importa hoy.
export default function Inicio() {
  const { perfil, modulosActivos } = useAuth();
  if (!perfil) return null;

  const activos = modulosVisibles(perfil.rol, modulosActivos).filter((m) => !m.siempre);
  const pendientes = modulosPendientes(perfil.rol, modulosActivos);

  return (
    <>
      <PageHeader titulo={`Hola, ${perfil.nombre}`} desc={`${ROL_ETIQUETA[perfil.rol]} en ${perfil.centroNombre}`} />
      <div className="grid gap-4">
        {perfil.rol === 'direccion' && <InicioDireccion activos={modulosActivos} />}
        {perfil.rol === 'coordinacion' && <InicioCoordinacion activos={modulosActivos} />}
        {perfil.rol === 'docente' && <InicioDocente activos={modulosActivos} />}
        {perfil.rol === 'admin' && <InicioAdmin />}
        {perfil.rol === 'orientacion' && <InicioOrientacion activos={modulosActivos} />}
        {perfil.rol === 'tutor' && <InicioGeneral />}

        <Card className="p-5">
          <h2 className="text-base font-semibold">Módulos de tu centro</h2>
          <p className="mb-3 text-sm text-muted">Se activan por entregas, con una bandera por centro.</p>
          <ul className="space-y-2 text-sm">
            {activos.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3">
                <span>{m.etiqueta}</span>
                <Chip tono="ok">Activo</Chip>
              </li>
            ))}
            {pendientes.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 text-muted">
                <span>{m.etiqueta}</span>
                <Chip>Entrega {m.entrega}</Chip>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
