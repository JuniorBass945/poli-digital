/**
 * Cuenta las peticiones a la base de datos que están en curso, para mostrar una animación de carga
 * en toda la aplicación sin tocar cada pantalla. Todo lo que pasa por el cliente de Supabase
 * (consultas, funciones, inicio de sesión) se cuenta solo.
 */
type Oyente = () => void;

let enCurso = 0;
const oyentes = new Set<Oyente>();
const avisar = () => oyentes.forEach((o) => o());

export const actividad = {
  inicio() {
    enCurso += 1;
    avisar();
  },
  fin() {
    enCurso = Math.max(0, enCurso - 1);
    avisar();
  },
  contar: () => enCurso,
  suscribir(oyente: Oyente) {
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },
};

/** fetch que avisa cuando una petición empieza y cuando termina (bien o mal). */
export const fetchConActividad: typeof fetch = async (entrada, opciones) => {
  actividad.inicio();
  try {
    return await globalThis.fetch(entrada, opciones);
  } finally {
    actividad.fin();
  }
};
