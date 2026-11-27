import { supabase } from "@/integrations/supabase/client";

export interface ComunicacaoMeta {
  instancia: string | null;
  apikey: string | null;
  empresa_id: string | null;
}

let cached: ComunicacaoMeta | null = null;
let cachedAt = 0;
const TTL_MS = 60_000;

/**
 * Busca os metadados de comunicação (instância, apikey da configuração
 * e id da empresa) que devem ser anexados a todos os webhooks do sistema.
 * Resultado fica em cache por 60s para evitar consultas redundantes.
 */
export const getComunicacaoMeta = async (): Promise<ComunicacaoMeta> => {
  const now = Date.now();
  if (cached && now - cachedAt < TTL_MS) return cached;

  try {
    const [{ data: configRows }, { data: empresaRow }] = await Promise.all([
      supabase
        .from("configuracoes")
        .select("chave, valor")
        .in("chave", ["comunicacao_instancia", "comunicacao_apikey"]),
      supabase.from("empresa_info").select("id").limit(1).maybeSingle(),
    ]);

    const map = new Map<string, string>();
    (configRows || []).forEach((r: any) => {
      if (r?.chave && r?.valor != null) map.set(r.chave, r.valor);
    });

    cached = {
      instancia: map.get("comunicacao_instancia") || null,
      apikey: map.get("comunicacao_apikey") || null,
      empresa_id: empresaRow?.id || null,
    };
    cachedAt = now;
    return cached;
  } catch (err) {
    console.error("⚠️ Erro ao carregar metadados de comunicação:", err);
    return { instancia: null, apikey: null, empresa_id: null };
  }
};

/** Invalida o cache (chamar após salvar novas configurações). */
export const invalidateComunicacaoMetaCache = () => {
  cached = null;
  cachedAt = 0;
};

/**
 * Mescla os metadados de comunicação ao payload do webhook.
 */
export const withComunicacaoMeta = async <T extends Record<string, any>>(
  payload: T
): Promise<T & ComunicacaoMeta> => {
  const meta = await getComunicacaoMeta();
  return { ...payload, ...meta };
};
