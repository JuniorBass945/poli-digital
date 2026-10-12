// Edge Function "accesos": crea, restablece y quita los accesos del personal (usuario + clave temporal).
//
// Por qué una función en el servidor: crear una cuenta con contraseña exige la llave "service_role", que NUNCA
// puede estar en el navegador. Supabase la entrega a esta función sola (variable SUPABASE_SERVICE_ROLE_KEY):
// no tienes que copiarla ni pegarla en ningún lado.
//
// Seguridad: antes de tocar nada, la función le pregunta a la base de datos —con la sesión de quien llama— si
// esa persona es administradora de su centro (funciones validar_* de la migración 20261017000100_accesos.sql).
// Despliegue:  npx supabase functions deploy accesos
import { createClient } from 'npm:@supabase/supabase-js@2';

// Debe ser igual a DOMINIO_INTERNO en src/lib/acceso.ts (una prueba lo comprueba).
const DOMINIO_INTERNO = 'poli.test';
const DIAS_VIGENCIA = 7;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } });

// Clave temporal de 12 caracteres (XXXX-XXXX-XXXX), sin letras que se confunden (0/O, 1/l/I), con mayúsculas, minúsculas y números.
function generarClaveTemporal(): string {
  const MAY = 'ABCDEFGHJKLMNPQRSTUVWXYZ', MIN = 'abcdefghijkmnopqrstuvwxyz', NUM = '23456789';
  const TODO = MAY + MIN + NUM;
  const azar = (n: number) => {
    const b = new Uint32Array(1);
    const limite = Math.floor(0x100000000 / n) * n;   // evita sesgo
    do { crypto.getRandomValues(b); } while (b[0] >= limite);
    return b[0] % n;
  };
  const pick = (s: string) => s[azar(s.length)];
  const c = [pick(MAY), pick(MIN), pick(NUM)];
  while (c.length < 12) c.push(pick(TODO));
  for (let i = c.length - 1; i > 0; i--) { const j = azar(i + 1); [c[i], c[j]] = [c[j], c[i]]; }
  const s = c.join('');
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}

// La administración puede escribir la clave temporal a mano (misma regla que validarClaveTemporal en src/lib/acceso.ts).
// Devuelve la clave a usar o un texto con el problema.
function elegirClave(manual: unknown, usuario?: string): { clave: string } | { problema: string } {
  if (manual === undefined || manual === null || manual === '') return { clave: generarClaveTemporal() };
  if (typeof manual !== 'string') return { problema: 'La clave temporal no es válida.' };
  if (manual.length < 8) return { problema: 'La clave temporal debe tener al menos 8 caracteres.' };
  if (manual.length > 72) return { problema: 'La clave temporal no puede pasar de 72 caracteres.' };
  if (!/[A-Za-z]/.test(manual) || !/[0-9]/.test(manual)) return { problema: 'La clave temporal debe combinar letras y números.' };
  if (usuario && manual.toLowerCase() === usuario.toLowerCase()) return { problema: 'La clave temporal no puede ser igual al usuario.' };
  return { clave: manual };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servicio = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const autorizacion = req.headers.get('Authorization') ?? '';
  if (!autorizacion) return json({ error: 'Inicia sesión para hacer esto.' }, 401);

  // Cliente "como quien llama": todo lo que valide la base de datos se evalúa con sus permisos.
  const quien = createClient(url, anon, { global: { headers: { Authorization: autorizacion } }, auth: { persistSession: false } });
  // Cliente de servicio: solo para crear/cambiar cuentas de acceso.
  const admin = createClient(url, servicio, { auth: { persistSession: false } });

  const { data: u, error: errU } = await quien.auth.getUser();
  if (errU || !u.user) return json({ error: 'Tu sesión no es válida. Entra de nuevo.' }, 401);
  const llamador = u.user.id;

  let cuerpo: Record<string, unknown>;
  try { cuerpo = await req.json(); } catch { return json({ error: 'Solicitud no válida.' }, 400); }
  const vence = new Date(Date.now() + DIAS_VIGENCIA * 86400000).toISOString();
  const falla = (e: { message: string; code?: string }) => json({ error: e.message, codigo: e.code ?? null }, e.code === '42501' ? 403 : 400);

  try {
    switch (cuerpo.accion) {
      case 'crear': {
        const args = {
          p_usuario: cuerpo.usuario, p_nombre: cuerpo.nombre, p_roles: cuerpo.roles,
          p_docente_id: cuerpo.docenteId ?? null, p_crear_docente: !!cuerpo.crearDocente,
        };
        // 1) La base revisa todo (permiso, usuario libre, roles) ANTES de crear la cuenta.
        const v = await quien.rpc('validar_nuevo_acceso', args);
        if (v.error) return falla(v.error);
        const usuario = v.data as string;
        // 2) Se crea la cuenta con la clave temporal. Queda marcada con quién la pidió.
        const elegida = elegirClave(cuerpo.claveManual, usuario);
        if ('problema' in elegida) return json({ error: elegida.problema }, 400);
        const clave = elegida.clave;
        const c = await admin.auth.admin.createUser({
          email: `${usuario}@${DOMINIO_INTERNO}`, password: clave, email_confirm: true,
          user_metadata: { creado_por: llamador },
        });
        if (c.error || !c.data.user) return json({ error: 'No se pudo crear la cuenta de acceso. Intenta de nuevo.' }, 400);
        // 3) Se registra el perfil, los roles y el vínculo. Si falla, se deshace la cuenta: no quedan restos.
        const r = await quien.rpc('registrar_acceso', { p_user_id: c.data.user.id, ...args, p_usuario: usuario });
        if (r.error) {
          await admin.auth.admin.deleteUser(c.data.user.id);
          return falla(r.error);
        }
        return json({ usuario, claveTemporal: clave, vence, perfilId: c.data.user.id });
      }

      case 'reiniciar': {
        const v = await quien.rpc('validar_reinicio_acceso', { p_perfil_id: cuerpo.perfilId });
        if (v.error) return falla(v.error);
        const elegida = elegirClave(cuerpo.claveManual, v.data as string);
        if ('problema' in elegida) return json({ error: elegida.problema }, 400);
        const clave = elegida.clave;
        const m = await admin.auth.admin.updateUserById(cuerpo.perfilId as string, { password: clave, ban_duration: 'none' });
        if (m.error) return json({ error: 'No se pudo restablecer la clave. Intenta de nuevo.' }, 400);
        const r = await quien.rpc('registrar_reinicio_acceso', { p_perfil_id: cuerpo.perfilId });
        if (r.error) return falla(r.error);
        return json({ usuario: v.data, claveTemporal: clave, vence });
      }

      case 'quitar': {
        const q = await quien.rpc('quitar_acceso', { p_perfil_id: cuerpo.perfilId });
        if (q.error) return falla(q.error);
        // Además de desactivar el perfil, se bloquea la cuenta para que no pueda ni iniciar sesión.
        await admin.auth.admin.updateUserById(cuerpo.perfilId as string, { ban_duration: '876000h' });
        return json({ ok: true });
      }

      default:
        return json({ error: 'Acción no válida.' }, 400);
    }
  } catch (e) {
    console.error('accesos', e);
    return json({ error: 'Ocurrió un error inesperado. Intenta de nuevo.' }, 500);
  }
});
