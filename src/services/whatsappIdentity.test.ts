import { describe, it } from 'node:test';
import { strictEqual, throws } from 'node:assert';
import { normalizeWhatsapp, whatsappKey, internalWhatsappEmail, isInternalEmail, validPassword, validCode } from '../../supabase/functions/_shared/whatsappIdentity';
describe('WhatsApp identity', () => {
  it('formats mobile numbers with DDI 55 without punctuation', () => {
    strictEqual(normalizeWhatsapp('(11) 93004-7549'), '5511930047549');
    strictEqual(normalizeWhatsapp('+55 (11) 93004-7549'), '5511930047549');
  });
  it('accepts landlines with DDI 55', () => {
    strictEqual(normalizeWhatsapp('(11) 4444-4444'), '551144444444');
  });
  it('resolves ninth-digit variants to the same identity', () => {
    strictEqual(whatsappKey('5511930047549'), whatsappKey('551130047549'));
  });
  it('rejects incomplete or non-Brazilian numbers', () => {
    throws(() => normalizeWhatsapp('123'));
    throws(() => normalizeWhatsapp('+1 202 555 0123'));
    throws(() => normalizeWhatsapp('5511830047549'));
  });
  it('uses a deterministic internal email only for new WhatsApp accounts', () => {
    strictEqual(internalWhatsappEmail('(11) 93004-7549'), '5511930047549@cliente.app');
  });
  it('hides internal emails but preserves staff email', () => {
    strictEqual(isInternalEmail('5511930047549@cliente.app'), true);
    strictEqual(isInternalEmail('staff@example.com'), false);
    strictEqual(isInternalEmail(null), false);
  });
  it('accepts passwords between 6 and 72 characters', () => {
    strictEqual(validPassword('12345'), false);
    strictEqual(validPassword('123456'), true);
    strictEqual(validPassword('a'.repeat(72)), true);
    strictEqual(validPassword('a'.repeat(73)), false);
  });
  it('requires a four-digit verification code including leading zeros', () => {
    strictEqual(validCode('0012'), true);
    strictEqual(validCode('012'), false);
    strictEqual(validCode('abcd'), false);
  });
});
