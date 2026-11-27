import { errorResponse, clients, json, corsHeaders, normalizeWhatsapp, validPassword, validCode, validChallengeId, findAccount, reserve, config, sendCode, consume } from '../_shared/whatsappAuth.ts';
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ status: 'invalid_input' }, 405);
  try {
    const body = await req.json();
    const { admin } = clients();
    if (body.action === 'start') {
      if (typeof body.phone !== 'string') return json({ status: 'invalid_input' }, 400);
      const phone = normalizeWhatsapp(body.phone);
      const id = await reserve(admin, req, phone, 'reset');
      if (!id) return json({ status: 'rate_limited' }, 429);
      const account = await findAccount(admin, phone);
      if (account.status === 'duplicate') return json({ status: 'duplicate' });
      // Same response for unknown phones; no email or account details are exposed.
      if (account.status === 'ok') await sendCode(admin, await config(admin), id, account.phone, 'reset', account.user.id);
      return json({ status: 'code_sent', challenge_id: id });
    }
    if (body.action !== 'verify' || !validChallengeId(body.challenge_id) || !validCode(body.code) || !validPassword(body.password)) return json({ status: 'invalid_input' }, 400);
    const challenge = await consume(admin, body.challenge_id, 'reset', body.code);
    if (!challenge?.user_id) return json({ status: 'invalid_code' });
    // Recheck the registered phone to avoid changing a different/ambiguous account after profile edits.
    const current = await findAccount(admin, challenge.phone);
    if (current.status !== 'ok' || current.user.id !== challenge.user_id) return json({ status: 'invalid_code' });
    const { error } = await admin.auth.admin.updateUserById(challenge.user_id, { password: body.password });
    if (error) return json({ status: 'error' }, 400);
    return json({ status: 'ok' });
  } catch (error) {
    return errorResponse(error);
  }
});
