import { supabase } from "@/integrations/supabase/client";
import { VariationGroup, MenuItem } from "@/types/menu";

type Row = {
  id: string;
  name: string;
  internal_name: string | null;
  min_required: number;
  max_allowed: number;
  variations: string[];
  custom_message: string | null;
  apply_to_half_pizza: boolean | null;
  allow_per_half: boolean | null;
  collapsible: boolean | null;
  hide_main_quantity_selector: boolean | null;
};

const fromRow = (r: Row): VariationGroup => ({
  id: r.id,
  name: r.name,
  internalName: r.internal_name ?? "",
  minRequired: r.min_required ?? 0,
  maxAllowed: r.max_allowed ?? 1,
  variations: r.variations ?? [],
  customMessage: r.custom_message ?? "",
  applyToHalfPizza: r.apply_to_half_pizza ?? false,
  allowPerHalf: r.allow_per_half ?? false,
  collapsible: r.collapsible ?? false,
  hideMainQuantitySelector: r.hide_main_quantity_selector ?? false,
});

const toRow = (g: VariationGroup) => ({
  id: g.id,
  name: g.name.trim(),
  internal_name: g.internalName?.trim() || "",
  min_required: g.minRequired,
  max_allowed: g.maxAllowed,
  variations: (g.variations ?? []).filter((id) => id && id.trim() !== ""),
  custom_message: g.customMessage?.trim() || "",
  apply_to_half_pizza: g.applyToHalfPizza ?? false,
  allow_per_half: g.allowPerHalf ?? false,
  collapsible: g.collapsible ?? false,
  hide_main_quantity_selector: g.hideMainQuantitySelector ?? false,
});

export const getAllVariationGroups = async (): Promise<VariationGroup[]> => {
  const { data, error } = await supabase.from("variation_groups").select("*");
  if (error) throw error;
  return (data as Row[]).map(fromRow);
};

export const getVariationGroup = async (id: string): Promise<VariationGroup | null> => {
  const { data, error } = await supabase
    .from("variation_groups")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
};

export const getVariationGroupById = getVariationGroup;

export const saveVariationGroup = async (variationGroup: VariationGroup): Promise<string> => {
  if (!variationGroup.name || variationGroup.name.trim() === "") {
    throw new Error("Nome do grupo de variação é obrigatório");
  }
  if (!variationGroup.variations || variationGroup.variations.length === 0) {
    throw new Error("Pelo menos uma variação deve ser selecionada");
  }
  if (variationGroup.minRequired < 0) variationGroup.minRequired = 0;
  if (variationGroup.maxAllowed < 1) variationGroup.maxAllowed = 1;
  if (variationGroup.minRequired > variationGroup.maxAllowed) {
    throw new Error("O mínimo obrigatório não pode ser maior que o máximo permitido");
  }

  const id = variationGroup.id && variationGroup.id.trim() !== "" ? variationGroup.id : crypto.randomUUID();
  const row = toRow({ ...variationGroup, id });
  const { error } = await supabase.from("variation_groups").upsert(row);
  if (error) throw new Error(`Falha ao salvar grupo: ${error.message}`);
  return id;
};

export const updateVariationGroup = saveVariationGroup;

export const deleteVariationGroup = async (id: string): Promise<void> => {
  if (!id || id.trim() === "") throw new Error("ID do grupo de variação é obrigatório");
  const { error } = await supabase.from("variation_groups").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar grupo de variação: ${error.message}`);
};

// Sincroniza as variações de um grupo com todos os itens de menu que o utilizam
export const syncMenuItemsWithVariationGroup = async (
  groupId: string,
  _newVariations: string[]
): Promise<void> => {
  const updatedGroup = await getVariationGroup(groupId);
  if (!updatedGroup) throw new Error(`Grupo de variações ${groupId} não encontrado`);

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, variation_groups");
  if (error) throw error;

  for (const row of data as { id: string; variation_groups: any }[]) {
    const groups = (row.variation_groups ?? []) as VariationGroup[];
    if (!groups.some((g) => g.id === groupId)) continue;

    const updated = groups.map((g) => (g.id === groupId ? { ...updatedGroup } : g));
    const { error: upErr } = await supabase
      .from("menu_items")
      .update({ variation_groups: updated as any })
      .eq("id", row.id);
    if (upErr) console.error("Erro ao sincronizar item", row.id, upErr);
  }
};

// Helpers para uso interno em outras partes (mantido para compatibilidade)
export const _internal = { getAllItems: async (): Promise<MenuItem[]> => [] };
