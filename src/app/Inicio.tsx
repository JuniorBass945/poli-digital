import { useState } from 'react';
import { Card, Chip, PageHeader, Tabs } from '../ui';
import { useAuth } from '../auth/AuthProvider';
import { ROL_ETIQUETA, etiquetaRoles, rolesDe, type Rol } from '../lib/roles';
import { modulosPendientes, modulosVisibles } from '../modules/registry';
import InicioAdmin from './inicio/InicioAdmin';
import InicioCoordinacion from './inicio/InicioCoordinacion';
import InicioDireccion from './inicio/InicioDireccion';
import InicioDocente from './inicio/InicioDocente';
import InicioGeneral from './inicio/InicioGeneral';
import InicioOrientacion from './inicio/InicioOrientacion';

// Pantalla de inicio: cada rol ve primero lo que le importa hoy.
// Con varios roles, una pestaña por rol: cada una muestra la portada de ese rol.
export default function Inicio() {
  const { perfil, modulosActivos } = useAuth();
  const [elegido, setElegido] = useState<Rol | null>(null);
  if (!perfil) return null;

  const roles = rolesDe(perfil);
  const rolActivo = elegido && roles.includes(elegido) ? elegido : roles[0];
  const activos = modulosVisibles(roles, modulosActivos).filter((m) => !m.siempre);
  const pendientes = modulosPendientes(roles, modulosActivos);

  return (
    <>
      <PageHeader titulo={`Hola, ${perfil.nombre}`} desc={`${etiquetaRoles(roles)} en ${perfil.centroNombre}`} />
      {roles.length > 1 && (
        <Tabs valor={rolActivo} onChange={(id) => setElegido(id as Rol)} tabs={roles.map((r) => ({ id: r, etiqueta: ROL_ETIQUETA[r] }))} />
      )}
      <div className="grid gap-4">
        {rolActivo === 'direccion' && <InicioDireccion activos={modulosActivos} />}
        {rolActivo === 'coordinacion' && <InicioCoordinacion activos={modulosActivos} />}
        {rolActivo === 'docente' && <InicioDocente activos={modulosActivos} />}
        {rolActivo === 'admin' && <InicioAdmin />}
        {rolActivo === 'orientacion' && <InicioOrientacion activos={modulosActivos} />}
        {rolActivo === 'tutor' && <InicioGeneral />}

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
