/**
 * Opt-out de métricas por navegador (uso do dono/desenvolvedor).
 * Flag guardada em localStorage + cookie de domínio por 365 dias.
 */
export const ANALYTICS_IGNORE_KEY = 'clickprato_ignore_analytics';
const MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

const readCookie = (): string | null => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ANALYTICS_IGNORE_KEY}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
};

const cookieDomain = (): string => {
  const host = window.location.hostname;
  if (host === 'localhost' || /^[\d.]+$/.test(host)) return '';
  const parts = host.split('.');
  return parts.length > 2 ? `; domain=.${parts.slice(-2).join('.')}` : `; domain=.${host}`;
};

const writeCookie = (value: string | null) => {
  const base = `${ANALYTICS_IGNORE_KEY}=${value ?? ''}; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  const age = value ? `; max-age=${MAX_AGE_SECONDS}` : '; max-age=0';
  // Tenta no domínio pai; se o navegador recusar, grava no host atual.
  document.cookie = base + age + cookieDomain();
  if (value && readCookie() !== value) document.cookie = base + age;
  if (!value) document.cookie = base + age;
};

export const isAnalyticsIgnored = (): boolean => {
  try {
    if (localStorage.getItem(ANALYTICS_IGNORE_KEY) === 'true') return true;
  } catch { /* storage indisponível */ }
  return readCookie() === 'true';
};

/** Use antes de enviar qualquer evento (Supabase, GA4/GTM, Pixel). */
export const shouldTrackAnalytics = (): boolean => !isAnalyticsIgnored();

export const setAnalyticsIgnored = (ignore: boolean) => {
  try {
    if (ignore) localStorage.setItem(ANALYTICS_IGNORE_KEY, 'true');
    else localStorage.removeItem(ANALYTICS_IGNORE_KEY);
  } catch { /* noop */ }
  writeCookie(ignore ? 'true' : null);
};

// Sincroniza localStorage a partir do cookie (ex.: outro subdomínio ativou).
if (typeof window !== 'undefined' && readCookie() === 'true') {
  try { localStorage.setItem(ANALYTICS_IGNORE_KEY, 'true'); } catch { /* noop */ }
}
