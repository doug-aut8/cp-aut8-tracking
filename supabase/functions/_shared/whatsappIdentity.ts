/** Pure rules shared with the client; never imports server credentials. */
export function normalizeWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const normalized = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  if (!/^55[1-9]\d\d{8,9}$/.test(normalized)) throw new Error('invalid_phone');
  if (normalized.length === 13 && normalized[4] !== '9') throw new Error('invalid_phone');
  return normalized;
}
export function whatsappKey(raw: string): string {
  const phone = normalizeWhatsapp(raw);
  return phone.length === 13 && phone[4] === '9' ? phone.slice(0, 4) + phone.slice(5) : phone;
}
export function internalWhatsappEmail(raw: string): string {
  return `${normalizeWhatsapp(raw)}@cliente.app`;
}
export function isInternalEmail(email?: string | null): boolean {
  return Boolean(email?.toLowerCase().endsWith('@cliente.app'));
}
export function validPassword(password: unknown): password is string {
  return typeof password === 'string' && password.length >= 6 && password.length <= 72;
}
export function validCode(code: unknown): code is string {
  return typeof code === 'string' && /^\d{4}$/.test(code);
}
