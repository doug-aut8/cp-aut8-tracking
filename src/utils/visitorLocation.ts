/**
 * Cidade estimada do visitante (inclusive não logado), obtida a partir do
 * endereço de internet. Serve para segmentar visitas/funil por cidade.
 * Bairro NÃO é estimado aqui por falta de precisão.
 */

const STORAGE_KEY = "visitor_city_v1";
const TTL_MS = 24 * 60 * 60 * 1000;

let cachedCity: string | null = null;

const readCache = (): string | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { city: string; at: number };
    if (!parsed?.city || Date.now() - parsed.at > TTL_MS) return null;
    return parsed.city;
  } catch {
    return null;
  }
};

/** Cidade já conhecida (sem chamadas de rede). */
export const getVisitorCity = (): string | null => {
  if (cachedCity) return cachedCity;
  cachedCity = readCache();
  return cachedCity;
};

/** Serviços de geolocalização por IP, tentados em ordem até um responder. */
const PROVIDERS: Array<{ url: string; pick: (json: any) => string }> = [
  { url: "https://ipwho.is/", pick: (j) => (j?.success === false ? "" : String(j?.city ?? "")) },
  { url: "https://ipapi.co/json/", pick: (j) => String(j?.city ?? "") },
];

const fetchCity = async (): Promise<string | null> => {
  for (const provider of PROVIDERS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(provider.url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const city = provider.pick(await res.json()).trim();
      if (city) return city;
    } catch {
      // Tenta o próximo serviço.
    }
  }
  return null;
};

/** Descobre a cidade uma vez por dia e guarda no navegador. */
export const initVisitorLocation = async (): Promise<void> => {
  if (getVisitorCity()) return;
  const city = await fetchCity();
  if (!city) return; // Sem localização: os eventos seguem sendo registrados sem cidade.
  cachedCity = city;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ city, at: Date.now() }));
};
