import { createClient } from '@supabase/supabase-js';
import { fetchConActividad } from './actividad';
import { env } from './env';

// Cuando el entorno no está configurado, la app muestra una pantalla de ayuda
// y este cliente no se usa. Cuando generes los tipos (npm run db:types), pásalos
// aquí con createClient<Database>(...).
// Todas las peticiones pasan por fetchConActividad: así la barra de carga global (CargaGlobal) sabe cuándo
// el sistema está trabajando, en cualquier pantalla.
export const supabase = createClient(env.url ?? 'http://localhost', env.anonKey ?? 'sin-configurar', {
  global: { fetch: fetchConActividad },
});
