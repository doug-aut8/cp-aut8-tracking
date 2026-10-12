/**
 * Cache em memória com TTL + deduplicação de requisições em voo.
 *
 * Vários painéis (marketing-metrics, admin-metrics, admin-intelligence) repetem
 * exatamente as mesmas consultas de pedidos, itens de cardápio e categorias
 * dentro de poucos segundos. Este cache centraliza esses resultados e evita
 * disparar a mesma query várias vezes.
 */

type Entry<T> = { value: T; expiresAt: number };

const cache = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export const DEFAULT_TTL_MS = 60_000;

export async function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const promise = (async () => {
    try {
      const value = await fetcher();
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/** Limpa o cache inteiro ou apenas as chaves que começam com o prefixo. */
export function invalidateQueryCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    inflight.clear();
    return;
  }
  Array.from(cache.keys()).forEach((k) => {
    if (k.startsWith(prefix)) cache.delete(k);
  });
  Array.from(inflight.keys()).forEach((k) => {
    if (k.startsWith(prefix)) inflight.delete(k);
  });
}
