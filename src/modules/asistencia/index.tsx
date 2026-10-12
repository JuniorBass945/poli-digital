import { useState } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { PageHeader, Tabs } from '../../ui';
import PasarLista from './PasarLista';
import Resumen from './Resumen';

// R1 · Asistencia: pasar lista (docente y coordinación) y resumen del período (todos los que ven el módulo).
export default function Asistencia() {
  const { perfil } = useAuth();
  const puedePasarLista = perfil?.rol === 'docente' || perfil?.rol === 'coordinacion' || perfil?.rol === 'admin';
  const [tab, setTab] = useState(puedePasarLista ? 'lista' : 'resumen');

  return (
    <>
      <PageHeader titulo="Asistencia" desc={puedePasarLista ? 'Pasa lista de tu clase de trabajo y revisa cómo va la asistencia.' : 'Cómo va la asistencia del centro: tendencias, aulas y estudiantes en riesgo.'} />
      {puedePasarLista && (
        <Tabs
          valor={tab}
          onChange={setTab}
          tabs={[
            { id: 'lista', etiqueta: 'Pasar lista' },
            { id: 'resumen', etiqueta: 'Resumen' },
          ]}
        />
      )}
      {tab === 'lista' && puedePasarLista && <PasarLista />}
      {tab === 'resumen' && <Resumen />}
    </>
  );
}
