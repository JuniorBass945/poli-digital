import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Cuando el entorno no está configurado, la app muestra una pantalla de ayuda
// y este cliente no se usa. Cuando generes los tipos (npm run db:types), pásalos
// aquí con createClient<Database>(...).
export const supabase = createClient(env.url ?? 'http://localhost', env.anonKey ?? 'sin-configurar');
