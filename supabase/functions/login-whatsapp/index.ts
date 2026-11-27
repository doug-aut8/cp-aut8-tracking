import { errorResponse, clients, json, corsHeaders, normalizeWhatsapp, findAccount, reserve, sessionResponse } from '../_shared/whatsappAuth.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ status: 'invalid_input' }, 405);
  try {
    const body = await req.json();
    if (typeof body.phone !== 'string' || typeof body.password !== 'string' || !body.password || body.password.length > 72) return json({ status: 'invalid_input' }, 400);
    const phone = normalizeWhatsapp(body.phone);
    const { admin, auth } = clients();
    if (!await reserve(admin, req, phone, 'login')) return json({ status: 'rate_limited' }, 429);
    const account = await findAccount(admin, phone);
    if (account.status !== 'ok') return json({ status: account.status });
    const email = account.user.email;
    if (!email) return json({ status: 'not_found' });
    return await sessionResponse(auth, email, body.password);
  } catch (error) {
    return errorResponse(error);
  }
});
