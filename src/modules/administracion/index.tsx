import { useState } from 'react';
import { PageHeader, Tabs } from '../../ui';
import Asignaciones from './Asignaciones';
import Aulas from './Aulas';
import Docentes from './Docentes';
import Estudiantes from './Estudiantes';
import Importar from './Importar';
import Materias from './Materias';

// R1 · Administración. Parte 1: Estudiantes. Parte 2: docentes, materias, aulas y asignaciones.
// Quedan para las siguientes partes: tutores e importación desde Excel.
export default function Administracion() {
  const [tab, setTab] = useState('estudiantes');
  return (
    <>
      <PageHeader titulo="Gestión de datos" desc="Registra y mantén al día a los estudiantes, docentes, materias, aulas y quién da cada materia." />
      <Tabs
        valor={tab}
        onChange={setTab}
        tabs={[
          { id: 'estudiantes', etiqueta: 'Estudiantes' },
          { id: 'importar', etiqueta: 'Importar Excel' },
          { id: 'docentes', etiqueta: 'Docentes' },
          { id: 'materias', etiqueta: 'Materias' },
          { id: 'aulas', etiqueta: 'Aulas' },
          { id: 'asignaciones', etiqueta: 'Asignaciones' },
          { id: 'tutores', etiqueta: 'Tutores', proximamente: true },
        ]}
      />
      {tab === 'estudiantes' && <Estudiantes />}
      {tab === 'importar' && <Importar />}
      {tab === 'docentes' && <Docentes />}
      {tab === 'materias' && <Materias />}
      {tab === 'aulas' && <Aulas />}
      {tab === 'asignaciones' && <Asignaciones />}
    </>
  );
}
