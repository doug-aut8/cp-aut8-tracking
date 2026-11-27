import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { normalizeWhatsapp, validCode, validPassword } from './whatsappIdentity.ts';
export { normalizeWhatsapp, validCode, validPassword, corsHeaders };
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export function clients() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !key || !anonKey) throw new Error('configuration');
  return {
    admin: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    auth: createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}
export type Admin = ReturnType<typeof clients>['admin'];
export async function hash(value: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(v => v.toString(16).padStart(2, '0')).join('');
}
export async function findAccount(admin: Admin, phone: string) {
  const { data, error } = await admin.rpc('whatsapp_find_users', { p_phone: phone });
  if (error) throw new Error('lookup');
  const rows = data || [];
  if (rows.length > 1) return { status: 'duplicate' as const };
  const row = rows[0];
  if (!row) return { status: 'not_found' as const };
  // Never trust the editable profile email or user_id for password reset.
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(row.id);
  if (authError || !authData.user?.email) return { status: 'not_found' as const };
  return { status: 'ok' as const, user: authData.user, phone: normalizeWhatsapp(row.phone) };
}
export async function reserve(admin: Admin, req: Request, phone: string, purpose: string) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
  const { data, error } = await admin.rpc('whatsapp_reserve_challenge', { p_phone: phone, p_purpose: purpose, p_ip_hash: await hash(ip) });
  if (error) throw new Error('rate_limit');
  return data as string | null;
}
export async function config(admin: Admin) {
  const { data, error } = await admin.from('configuracoes').select('chave,valor').in('chave', ['webhook_autenticacao', 'whatsapp_verification_enabled', 'comunicacao_instancia', 'comunicacao_apikey']);
  if (error) throw new Error('configuration');
  return new Map<string, string>((data || []).map(r => [r.chave, r.valor || '']));
}
export async function sendCode(admin: Admin, settings: Map<string,string>, id: string, phone: string, purpose: string, userId?: string, name?: string) {
  const url = settings.get('webhook_autenticacao');
  if (!url || !url.startsWith('https://')) throw new Error('webhook_configuration');
  // Unbiased 4-digit code; stored only as a challenge-specific hash.
  const values = new Uint32Array(1);
  do { crypto.getRandomValues(values); } while (values[0] >= 4294960000);
  const code = String(values[0] % 10000).padStart(4, '0');
  const { error } = await admin.from('whatsapp_auth_challenges').update({ code_hash: await hash(`${id}:${code}`), user_id: userId || null, name: name || null }).eq('id', id);
  if (error) throw new Error('challenge');
  const { data: company } = await admin.from('empresa_info').select('id').limit(1).maybeSingle();
  // Codes and communication credentials go ONLY to the configured webhook, never to the browser.
  const response = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15000),
    body: JSON.stringify({ phone, phone_cadastrado: userId ? phone : null, user_id: userId || null, name: name || null,
      code, whatsapp_auth_code: code, purpose, challenge_id: id, expires_in: 600,
      instancia: settings.get('comunicacao_instancia') || null, apikey: settings.get('comunicacao_apikey') || null, empresa_id: company?.id || null }),
  });
  if (!response.ok) {
    await admin.from('whatsapp_auth_challenges').update({ used_at: new Date().toISOString() }).eq('id', id);
    throw new Error('delivery');
  }
}
export async function consume(admin: Admin, id: string, purpose: string, code: string) {
  const { data, error } = await admin.rpc('whatsapp_consume_challenge', { p_id: id, p_purpose: purpose, p_code_hash: await hash(`${id}:${code}`) });
  if (error) throw new Error('challenge');
  return data?.[0] as { phone: string; user_id: string | null; name: string | null } | undefined;
}
export function validChallengeId(value: unknown): value is string { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export async function sessionResponse(auth: ReturnType<typeof clients>['auth'], email: string, password: string) {
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session) return json({ status: 'wrong_password' });
  return json({ status: 'ok', access_token: data.session.access_token, refresh_token: data.session.refresh_token });
}

// Log only safe classifications: never codes, tokens, request bodies or provider responses.
export function errorResponse(error: unknown) {
  const category = error instanceof Error ? error.message : 'unknown';
  const safe = ['invalid_phone', 'configuration', 'webhook_configuration', 'delivery', 'lookup', 'rate_limit', 'challenge'].includes(category) ? category : 'unknown';
  console.warn(`WhatsApp auth failure: ${safe}`);
  if (safe === 'invalid_phone' || error instanceof SyntaxError) return json({ status: 'invalid_input' }, 400);
  if (safe === 'delivery') return json({ status: 'delivery_error' }, 502);
  if (safe === 'configuration' || safe === 'webhook_configuration') return json({ status: 'configuration_error' }, 503);
  return json({ status: 'error' }, 500);
}
