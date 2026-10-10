import { useState } from 'react';
import { PageHeader, Tabs } from '../../ui';
import Estudiantes from './Estudiantes';

// R1 · Administración. Parte 1: Estudiantes. Las demás pestañas llegan en las siguientes partes.
export default function Administracion() {
  const [tab, setTab] = useState('estudiantes');
  return (
    <>
      <PageHeader titulo="Gestión de datos" desc="Registra, edita y da de baja a los estudiantes. Lo que cambies aquí se refleja en los demás módulos." />
      <Tabs
        valor={tab}
        onChange={setTab}
        tabs={[
          { id: 'estudiantes', etiqueta: 'Estudiantes' },
          { id: 'docentes', etiqueta: 'Docentes', proximamente: true },
          { id: 'tutores', etiqueta: 'Tutores', proximamente: true },
          { id: 'asignaciones', etiqueta: 'Materias y asignaciones', proximamente: true },
          { id: 'aulas', etiqueta: 'Aulas', proximamente: true },
        ]}
      />
      {tab === 'estudiantes' && <Estudiantes />}
    </>
  );
}
