import { assertEquals, assert, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { clients, hash, findAccount, consume } from '../_shared/whatsappAuth.ts';
import { normalizeWhatsapp, validCode, validPassword } from '../_shared/whatsappIdentity.ts';

Deno.test('WhatsApp uses Brazilian numbers without punctuation', () => {
  assertEquals(normalizeWhatsapp('(11) 93004-7549'), '5511930047549');
  assertEquals(normalizeWhatsapp('(11) 4444-4444'), '551144444444');
});
Deno.test('Passwords accept 6 through 72 characters', () => {
  assert(validPassword('123456')); assert(validPassword('a'.repeat(72)));
  assertEquals(validPassword('12345'), false); assertEquals(validPassword('a'.repeat(73)), false);
});
Deno.test('Verification requires four digits, including leading zero', () => {
  assert(validCode('0012')); assertEquals(validCode('012'), false); assertEquals(validCode('abcd'), false);
});

// Opt-in integration checks: never send messages or modify an existing account.
Deno.test({
  name: 'Private challenges expire, stop after five attempts, and are single-use',
  ignore: !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  fn: async () => {
    const { admin } = clients();
    const ids: string[] = [];
    const make = async (fields: Record<string, unknown> = {}) => {
      const id = crypto.randomUUID(); ids.push(id);
      const { error } = await admin.from('whatsapp_auth_challenges').insert({ id, phone: '5511999990000', purpose: 'reset', ip_hash: 'automated-test', code_hash: await hash(`${id}:0012`), ...fields });
      if (error) throw new Error('Cannot create temporary challenge');
      return id;
    };
    try {
      const expired = await make({ expires_at: new Date(Date.now() - 1000).toISOString() });
      assertEquals(await consume(admin, expired, 'reset', '0012'), undefined);
      const attempts = await make();
      for (let i = 0; i < 5; i++) assertEquals(await consume(admin, attempts, 'reset', '0000'), undefined);
      assertEquals(await consume(admin, attempts, 'reset', '0012'), undefined);
      const singleUse = await make();
      assertEquals((await consume(admin, singleUse, 'reset', '0012'))?.phone, '5511999990000');
      assertEquals(await consume(admin, singleUse, 'reset', '0012'), undefined);
    } finally {
      const { error } = await admin.from('whatsapp_auth_challenges').delete().in('id', ids);
      if (error) throw new Error('Cannot remove temporary challenges');
    }
  },
});

Deno.test({
  name: 'New WhatsApp account preserves Auth ID and staff email sign-in',
  ignore: !Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  fn: async () => {
    const { admin, auth } = clients();
    const digits = Array.from(crypto.getRandomValues(new Uint8Array(8)), n => String(n % 10)).join('');
    const phone = `55119${digits}`;
    const email = `migration-test-${crypto.randomUUID()}@example.com`;
    const password = crypto.randomUUID();
    let id: string | undefined;
    try {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name: 'Temporary migration validation', phone } });
      if (error || !data.user) throw new Error('Cannot create temporary account');
      id = data.user.id;
      const account = await findAccount(admin, phone);
      assertEquals(account.status, 'ok');
      if (account.status !== 'ok') throw new Error('Cannot resolve temporary account');
      assertEquals(account.user.id, id);
      const { data: signedIn, error: signInError } = await auth.auth.signInWithPassword({ email: account.user.email || '', password });
      if (signInError) throw new Error('Temporary account sign-in failed');
      assertEquals(signedIn.user?.id, id);
      const { data: profile } = await admin.from('users').select('name,phone').eq('id', id).single();
      assertEquals(profile?.phone, phone);
      assertEquals(profile?.name, 'Temporary migration validation');
      await auth.auth.signOut();
    } finally {
      if (id) {
        // users has legacy downstream references, so remove only our UUID before Auth cleanup.
        const { error } = await admin.from('users').delete().eq('id', id);
        if (error) throw new Error('Cannot remove temporary profile');
        const { error: authError } = await admin.auth.admin.deleteUser(id);
        if (authError) throw new Error('Cannot remove temporary account');
      }
    }
  },
});
