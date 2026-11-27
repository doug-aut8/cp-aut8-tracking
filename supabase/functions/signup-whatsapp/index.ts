import { errorResponse, clients, json, corsHeaders, normalizeWhatsapp, validPassword, validCode, validChallengeId, findAccount, reserve, config, sendCode, consume, sessionResponse } from '../_shared/whatsappAuth.ts';
import { internalWhatsappEmail } from '../_shared/whatsappIdentity.ts';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ status: 'invalid_input' }, 405);
  try {
    const body = await req.json();
    if (!validPassword(body.password)) return json({ status: 'invalid_input' }, 400);
    const { admin, auth } = clients();
    let phone: string;
    let name: string;
    if (body.action === 'verify') {
      if (!validChallengeId(body.challenge_id) || !validCode(body.code)) return json({ status: 'invalid_input' }, 400);
      const challenge = await consume(admin, body.challenge_id, 'signup', body.code);
      if (!challenge?.name) return json({ status: 'invalid_code' });
      phone = challenge.phone; name = challenge.name;
    } else if (body.action === 'start') {
      if (typeof body.phone !== 'string' || typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.length > 100) return json({ status: 'invalid_input' }, 400);
      phone = normalizeWhatsapp(body.phone); name = body.name.trim();
      const id = await reserve(admin, req, phone, 'signup');
      if (!id) return json({ status: 'rate_limited' }, 429);
      const account = await findAccount(admin, phone);
      if (account.status !== 'not_found') return json({ status: account.status === 'duplicate' ? 'duplicate' : 'exists' });
      const settings = await config(admin);
      if (settings.get('whatsapp_verification_enabled') !== 'false') {
        await sendCode(admin, settings, id, phone, 'signup', undefined, name);
        return json({ status: 'code_sent', challenge_id: id });
      }
    } else return json({ status: 'invalid_input' }, 400);
    const existing = await findAccount(admin, phone);
    if (existing.status !== 'not_found') return json({ status: existing.status === 'duplicate' ? 'duplicate' : 'exists' });
    const email = internalWhatsappEmail(phone);
    // Existing confirmation setting is respected; explicit server confirmation is only used after WhatsApp validation
    // or when the store explicitly disabled WhatsApp verification.
    const { data, error } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true, user_metadata: { name, phone } });
    if (error || !data.user) {
      const collision = await findAccount(admin, phone);
      if (error?.code === 'email_exists' || collision.status === 'ok') return json({ status: 'exists' });
      console.warn('WhatsApp signup failed during account creation');
      return json({ status: 'error' }, 500);
    }
    return await sessionResponse(auth, email, body.password);
  } catch (error) {
    return errorResponse(error);
  }
});
