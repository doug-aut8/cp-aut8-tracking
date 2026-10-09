import { getUtmParams } from './utmCapture';

const REFERRER_STORAGE_KEY = 'traffic_referrer';

export type TrafficChannel = 'organico' | 'social' | 'pago' | 'direto' | 'outros';

const SEARCH_DOMAINS = ['google.', 'bing.', 'yahoo.', 'duckduckgo.', 'ecosia.', 'search.brave.'];
const SOCIAL_DOMAINS = [
  'instagram.',
  'facebook.',
  'fb.',
  'l.facebook.',
  'm.facebook.',
  'messenger.',
  'tiktok.',
  'whatsapp.',
  'wa.me',
  'youtube.',
  'youtu.be',
  'linkedin.',
  'twitter.',
  'x.com',
  'pinterest.',
  'threads.',
  'telegram.',
  't.me',
];
const PAID_MEDIUMS = ['cpc', 'ppc', 'paid', 'paidsocial', 'paid_social', 'ads', 'display', 'meta_ads', 'google_ads'];

/** Normaliza um referrer bruto para um domínio limpo (ex.: "instagram.com"). */
export const normalizeReferrer = (raw: string): string => {
  if (!raw) return 'direto';
  try {
    const host = new URL(raw).hostname.toLowerCase().replace(/^www\./, '');
    if (!host) return 'direto';
    // Agrupa subdomínios conhecidos
    if (host.includes('facebook')) return 'facebook.com';
    if (host.includes('instagram')) return 'instagram.com';
    if (host.includes('google')) return 'google.com';
    if (host.includes('whatsapp') || host === 'wa.me') return 'whatsapp.com';
    if (host.includes('youtube') || host === 'youtu.be') return 'youtube.com';
    if (host.includes('tiktok')) return 'tiktok.com';
    if (host === 't.co' || host.includes('twitter') || host === 'x.com') return 'x.com';
    return host;
  } catch {
    return 'direto';
  }
};

const matches = (host: string, list: string[]) => list.some((d) => host.includes(d));

/** Classifica o canal a partir das UTMs e do referrer normalizado. */
export const classifyChannel = (referrer: string): TrafficChannel => {
  const utms = getUtmParams();
  const medium = (utms.utm_medium ?? '').toLowerCase();
  const source = (utms.utm_source ?? '').toLowerCase();

  if (medium && PAID_MEDIUMS.some((m) => medium.includes(m))) return 'pago';
  if (medium === 'social' || matches(source, SOCIAL_DOMAINS) || ['ig', 'fb', 'instagram', 'facebook', 'tiktok', 'whatsapp'].includes(source)) {
    return 'social';
  }
  if (medium === 'organic' || matches(source, SEARCH_DOMAINS)) return 'organico';

  if (referrer && referrer !== 'direto') {
    if (matches(referrer, SOCIAL_DOMAINS)) return 'social';
    if (matches(referrer, SEARCH_DOMAINS)) return 'organico';
    return 'outros';
  }

  if (!source && !utms.utm_campaign) return 'direto';
  return 'outros';
};

/** Captura o referrer da entrada e persiste na sessão (ignora navegação interna). */
export const captureReferrer = (): void => {
  try {
    const stored = sessionStorage.getItem(REFERRER_STORAGE_KEY);
    const raw = document.referrer || '';
    const isInternal = raw ? new URL(raw).hostname === window.location.hostname : false;

    if (!stored || (raw && !isInternal)) {
      const normalized = isInternal && stored ? stored : normalizeReferrer(raw);
      if (!stored || normalized !== 'direto') {
        sessionStorage.setItem(REFERRER_STORAGE_KEY, normalized);
      }
    }
  } catch {
    /* ignora */
  }
};

/** Referrer normalizado da sessão atual. */
export const getReferrer = (): string => {
  try {
    return sessionStorage.getItem(REFERRER_STORAGE_KEY) || 'direto';
  } catch {
    return 'direto';
  }
};

/** Canal de tráfego da sessão atual. */
export const getChannel = (): TrafficChannel => classifyChannel(getReferrer());
