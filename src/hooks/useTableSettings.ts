import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TableSettings {
  mesas_ativo: boolean;
  mesas_quantidade: number;
  mesas_pix_ativo: boolean;
  mesas_cobranca_ativo: boolean;
  mesas_pix_chave: string;
  mesas_mensagem: string;
}

export const DEFAULT_TABLE_SETTINGS: TableSettings = {
  mesas_ativo: true,
  mesas_quantidade: 10,
  mesas_pix_ativo: true,
  mesas_cobranca_ativo: true,
  mesas_pix_chave: "",
  mesas_mensagem: "",
};

const KEYS = Object.keys(DEFAULT_TABLE_SETTINGS) as (keyof TableSettings)[];

const parse = (rows: { chave: string; valor: string | null }[]): TableSettings => {
  const s: any = { ...DEFAULT_TABLE_SETTINGS };
  for (const r of rows) {
    if (!KEYS.includes(r.chave as keyof TableSettings)) continue;
    const def = (DEFAULT_TABLE_SETTINGS as any)[r.chave];
    if (typeof def === "boolean") s[r.chave] = r.valor === "true";
    else if (typeof def === "number") s[r.chave] = Number(r.valor) || def;
    else s[r.chave] = r.valor ?? "";
  }
  return s;
};

export const useTableSettings = () => {
  const [settings, setSettings] = useState<TableSettings>(DEFAULT_TABLE_SETTINGS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from("configuracoes").select("chave, valor").in("chave", KEYS as string[]);
    setSettings(parse((data as any[]) || []));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (next: TableSettings) => {
    const { data: existing } = await supabase.from("configuracoes").select("id, chave").in("chave", KEYS as string[]);
    const byKey = new Map(((existing as any[]) || []).map((r) => [r.chave, r.id]));
    for (const key of KEYS) {
      const valor = String(next[key]);
      const id = byKey.get(key);
      const { error } = id
        ? await supabase.from("configuracoes").update({ valor }).eq("id", id)
        : await supabase.from("configuracoes").insert({ chave: key, valor });
      if (error) throw error;
    }
    // Sincroniza tabela de mesas (1..N)
    const nums = Array.from({ length: next.mesas_quantidade }, (_, i) => formatTableNumber(i + 1));
    const { error: mErr } = await (supabase as any)
      .from("mesas")
      .upsert(nums.map((numero) => ({ numero, ativa: true })), { onConflict: "numero" });
    if (mErr) throw mErr;
    const { data: all } = await (supabase as any).from("mesas").select("numero");
    const extra = ((all as any[]) || []).map((m) => m.numero).filter((n: string) => !nums.includes(n));
    if (extra.length) await (supabase as any).from("mesas").update({ ativa: false }).in("numero", extra);
    setSettings(next);
  };

  return { settings, loading, save, reload: load };
};

export const formatTableNumber = (n: number | string) => {
  const s = String(n).trim();
  return /^\d+$/.test(s) ? s.padStart(2, "0") : s;
};

const TABLE_KEY = "mesa_atual";
const CUSTOMER_KEY = "mesa_cliente";
export const getStoredTable = () => sessionStorage.getItem(TABLE_KEY);
export const setStoredTable = (m: string) => sessionStorage.setItem(TABLE_KEY, m);
export interface TableCustomer {
  mesa: string;
  name: string;
  phone: string;
  birthday: string; // DD/MM
  submitted?: boolean;
}
export const getStoredTableCustomer = (): TableCustomer | null => {
  try { return JSON.parse(localStorage.getItem(CUSTOMER_KEY) || "null"); } catch { return null; }
};
export const setStoredTableCustomer = (c: TableCustomer) =>
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(c));
export const clearStoredTableCustomer = () => localStorage.removeItem(CUSTOMER_KEY);

/** Mesa fechada = admin concluiu e marcou como pago, ou cancelou. */
export const hasOpenTableOrder = async (mesa: string, phone: string) => {
  const { data, error } = await (supabase as any).rpc("mesa_cliente_tem_pedido_aberto", { _mesa: mesa, _telefone: phone });
  if (error) return true; // em caso de falha, mantém os dados
  return !!data;
};
