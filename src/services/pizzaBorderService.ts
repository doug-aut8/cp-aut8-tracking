import { supabase } from "@/integrations/supabase/client";

export interface PizzaBorder {
  id: string;
  name: string;
  description?: string;
  additionalPrice: number;
  available: boolean;
}

type Row = {
  id: string;
  name: string;
  description: string | null;
  additional_price: number;
  available: boolean;
};

const fromRow = (r: Row): PizzaBorder => ({
  id: r.id,
  name: r.name,
  description: r.description ?? "",
  additionalPrice: Number(r.additional_price ?? 0),
  available: r.available ?? true,
});

const toRow = (b: PizzaBorder) => ({
  id: b.id,
  name: b.name.trim(),
  description: b.description?.trim() || "",
  additional_price: b.additionalPrice || 0,
  available: b.available ?? true,
});

export const getAllPizzaBorders = async (): Promise<PizzaBorder[]> => {
  const { data, error } = await supabase.from("pizza_borders").select("*");
  if (error) throw error;
  return (data as Row[]).map(fromRow);
};

export const getPizzaBorder = async (id: string): Promise<PizzaBorder | null> => {
  const { data, error } = await supabase
    .from("pizza_borders")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as Row) : null;
};

export const savePizzaBorder = async (border: PizzaBorder): Promise<string> => {
  if (!border.name || border.name.trim() === "") throw new Error("Nome da borda é obrigatório");
  const isNew = !border.id || border.id.trim() === "" || border.id.startsWith("temp-");
  const id = isNew ? crypto.randomUUID() : border.id;
  const row = toRow({ ...border, id });
  const { error } = await supabase.from("pizza_borders").upsert(row);
  if (error) throw new Error(`Falha ao salvar borda: ${error.message}`);
  return id;
};

export const deletePizzaBorder = async (id: string): Promise<void> => {
  if (!id || id.trim() === "") throw new Error("ID da borda é obrigatório");
  const { error } = await supabase.from("pizza_borders").delete().eq("id", id);
  if (error) throw new Error(`Falha ao deletar borda: ${error.message}`);
};

/**
 * Sincroniza as bordas (jsonb pizza_borders) em todos os itens do menu.
 * Atualiza dados das bordas existentes e remove bordas que não existem mais.
 */
export const syncBordersToMenuItems = async (): Promise<number> => {
  const allBorders = await getAllPizzaBorders();
  const bordersMap = new Map(allBorders.map((b) => [b.id, b]));

  const { data, error } = await supabase
    .from("menu_items")
    .select("id, pizza_borders");
  if (error) throw error;

  let updatedCount = 0;
  for (const row of data as { id: string; pizza_borders: any }[]) {
    const itemBorders = (row.pizza_borders ?? []) as PizzaBorder[];
    if (itemBorders.length === 0) continue;

    const updated = itemBorders
      .map((b) => bordersMap.get(b.id) ?? null)
      .filter((b): b is PizzaBorder => b !== null);

    const changed =
      updated.length !== itemBorders.length ||
      JSON.stringify(updated) !== JSON.stringify(itemBorders);

    if (changed) {
      const { error: upErr } = await supabase
        .from("menu_items")
        .update({ pizza_borders: updated as any })
        .eq("id", row.id);
      if (!upErr) updatedCount++;
    }
  }
  return updatedCount;
};
