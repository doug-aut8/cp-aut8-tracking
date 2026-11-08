import { supabase } from "@/integrations/supabase/client";
import type { MenuItem } from "@/types/menu";

export type GatilhoTipo = "categoria" | "produto";

export interface SugestaoRegra {
  id?: string;
  nome: string;
  titulo: string;
  gatilho_tipo: GatilhoTipo;
  gatilho_ids: string[];
  sugestao_ids: string[];
  prioridade: number;
  ativo: boolean;
  desconto_valor?: number;
}

const table = () => (supabase as any).from("sugestoes_regras");

let cache: { data: SugestaoRegra[]; ts: number } | null = null;
const TTL = 60_000;

export const getRegrasAtivas = async (): Promise<SugestaoRegra[]> => {
  if (cache && Date.now() - cache.ts < TTL) return cache.data;
  const { data, error } = await table().select("*").eq("ativo", true).order("prioridade", { ascending: false });
  if (error) throw error;
  cache = { data: data ?? [], ts: Date.now() };
  return cache.data;
};

export const getTodasRegras = async (): Promise<SugestaoRegra[]> => {
  const { data, error } = await table().select("*").order("prioridade", { ascending: false });
  if (error) throw error;
  return data ?? [];
};

export const salvarRegra = async (r: SugestaoRegra) => {
  cache = null;
  const { id, ...rest } = r;
  const { error } = id ? await table().update(rest).eq("id", id) : await table().insert(rest);
  if (error) throw error;
};

export const excluirRegra = async (id: string) => {
  cache = null;
  const { error } = await table().delete().eq("id", id);
  if (error) throw error;
};

/** Regra dispara se algum item do carrinho casa com o gatilho (produto ou categoria principal/adicional). */
export const regraDispara = (regra: SugestaoRegra, cart: Array<Partial<MenuItem>>): boolean =>
  cart.some((item) => {
    const baseId = String(item.id ?? "");
    if (regra.gatilho_tipo === "produto") {
      return regra.gatilho_ids.some((g) => baseId === g || baseId.startsWith(g));
    }
    const cats = [item.category, ...(item.additionalCategories ?? [])].filter(Boolean) as string[];
    return cats.some((c) => regra.gatilho_ids.includes(c));
  });

/** Calcula os produtos sugeridos (sem duplicar e sem itens já no carrinho). */
export const calcularSugestoes = (
  regras: SugestaoRegra[],
  cart: Array<Partial<MenuItem>>,
  menu: MenuItem[],
): { titulo: string; itens: MenuItem[]; descontos: Record<string, number> } => {
  const noCarrinho = cart.map((c) => String(c.id ?? ""));
  const ids: string[] = [];
  let titulo = "";
  const descontos: Record<string, number> = {};
  for (const r of regras) {
    if (!r.ativo || !regraDispara(r, cart)) continue;
    if (!titulo) titulo = r.titulo;
    const d = Math.max(0, Number(r.desconto_valor) || 0);
    for (const s of r.sugestao_ids) {
      if (!ids.includes(s)) ids.push(s);
      if (d > (descontos[s] ?? 0)) descontos[s] = d;
    }
  }
  const itens = ids
    .map((id) => menu.find((m) => m.id === id))
    .filter((m): m is MenuItem => !!m && m.available !== false && m.stock !== 0)
    .filter((m) => !noCarrinho.some((c) => c === m.id || c.startsWith(m.id)));
  return { titulo: titulo || "Peça também", itens, descontos };
};

/** Preço final com desconto fixo em reais (nunca negativo). */
export const aplicarDesconto = (preco: number, desconto: number) =>
  Math.max(0, Math.round(((preco || 0) - (desconto || 0)) * 100) / 100);

export const UPSELL_FLAG = "upsell_return_item";
