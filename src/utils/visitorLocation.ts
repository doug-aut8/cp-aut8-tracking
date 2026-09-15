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

/** Descobre a cidade uma vez por dia e guarda no navegador. */
export const initVisitorLocation = async (): Promise<void> => {
  if (getVisitorCity()) return;
  try {
    const res = await fetch("https://ipapi.co/json/");
    if (!res.ok) return;
    const json = await res.json();
    const city = String(json?.city ?? "").trim();
    if (!city) return;
    cachedCity = city;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ city, at: Date.now() }));
  } catch {
    // Sem localização: os eventos seguem sendo registrados sem cidade.
  }
};
