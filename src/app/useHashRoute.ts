import { useEffect, useState } from 'react';

/** Ruta mínima basada en el hash (#/asistencia): permite enlaces directos y el botón "atrás" sin dependencias. */
export function useHashRoute(porDefecto = 'inicio'): [string, (id: string) => void] {
  const leer = () => window.location.hash.replace(/^#\/?/, '') || porDefecto;
  const [ruta, setRuta] = useState(leer);
  useEffect(() => {
    const alCambiar = () => setRuta(leer());
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  });
  return [ruta, (id) => { window.location.hash = `/${id}`; }];
}
