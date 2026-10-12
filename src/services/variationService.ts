import { supabase } from "@/integrations/supabase/client";
import { Variation } from "@/types/menu";

type Row = {
  id: string;
  name: string;
  description: string | null;
  additional_price: number;
  available: boolean;
  category_ids: string[];
};

const fromRow = (r: Row): Variation => ({
  id: r.id,
  name: r.name,
  description: r.description ?? "",
  additionalPrice: Number(r.additional_price ?? 0),
  available: r.available ?? true,
  categoryIds: r.category_ids ?? [],
});

const toRow = (v: Variation) => ({
  id: v.id,
  name: v.name,
  description: v.description ?? "",
  additional_price: typeof v.additionalPrice === "number" ? v.additionalPrice : 0,
  available: v.available ?? true,
  category_ids: v.categoryIds ?? [],
});

let _allVariationsCache: { data: Variation[]; ts: number } | null = null;
let _allVariationsInFlight: Promise<Variation[]> | null = null;
const VARIATIONS_TTL_MS = 60_000;

export const invalidateVariationsCache = () => {
  _allVariationsCache = null;
  _allVariationsInFlight = null;
};

export const getAllVariations = async (): Promise<Variation[]> => {
  const now = Date.now();
  if (_allVariationsCache && now - _allVariationsCache.ts < VARIATIONS_TTL_MS) {
    return _allVariationsCache.data;
  }
  if (_allVariationsInFlight) return _allVariationsInFlight;
  _allVariationsInFlight = (async () => {
    const { data, error } = await supabase.from("variations").select("*");
    if (error) {
      _allVariationsInFlight = null;
      throw error;
    }
    const items = (data as Row[]).map(fromRow);
    _allVariationsCache = { data: items, ts: Date.now() };
    _allVariationsInFlight = null;
    return items;
  })();
  return _allVariationsInFlight;
};

export const getVariation = async (id: string): Promise<Variation | null> => {
  const { data, error } = await supabase
    .from("variations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
};

export const getVariationById = getVariation;

export const saveVariation = async (variation: Variation): Promise<string> => {
  if (!variation.name) throw new Error("Nome da variação é obrigatório");
  const id = variation.id && variation.id.trim() !== "" ? variation.id : crypto.randomUUID();
  const row = toRow({ ...variation, id });
  const { error } = await supabase.from("variations").upsert(row);
  if (error) throw new Error(`Falha ao salvar variação: ${error.message}`);
  invalidateVariationsCache();
  return id;
};

export const deleteVariation = async (id: string): Promise<void> => {
  if (!id || id.trim() === "") throw new Error("ID da variação é obrigatório para exclusão");
  const { error } = await supabase.from("variations").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar variação: ${error.message}`);
  invalidateVariationsCache();
};
