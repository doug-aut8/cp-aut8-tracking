import { supabase } from "@/integrations/supabase/client";
import { PizzaSize } from "@/types/menu";

export interface SizeTemplateEntry {
  id: string;
  name: string;
}

export interface SizeTemplate {
  id: string;
  name: string;
  sizes: SizeTemplateEntry[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export const getSizeTemplates = async (): Promise<SizeTemplate[]> => {
  const { data, error } = await db.from("size_templates").select("id, name, sizes").order("name");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, sizes: Array.isArray(r.sizes) ? r.sizes : [] }));
};

/**
 * Monta os tamanhos do item a partir do conjunto: nomes e ids vêm do conjunto,
 * preço/custo são preservados do item (casando por id e depois por nome).
 */
export const applyTemplateToSizes = (template: SizeTemplate, current: PizzaSize[] = []): PizzaSize[] =>
  template.sizes.map((s) => {
    const norm = (v: string) => v.trim().toLowerCase();
    const prev = current.find((c) => c.id === s.id) ?? current.find((c) => norm(c.name) === norm(s.name));
    return { id: s.id, name: s.name, price: prev?.price ?? 0, cost: prev?.cost ?? 0 };
  });

/** Salva o conjunto e sincroniza nomes/ordem nos itens das categorias que o usam. */
export const saveSizeTemplate = async (t: { id?: string; name: string; sizes: SizeTemplateEntry[] }): Promise<void> => {
  const payload = { name: t.name.trim(), sizes: t.sizes.map((s) => ({ id: s.id, name: s.name.trim() })) };
  let id = t.id;
  if (id) {
    const { error } = await db.from("size_templates").update(payload).eq("id", id);
    if (error) throw error;
  } else {
    const { data, error } = await db.from("size_templates").insert(payload).select("id").single();
    if (error) throw error;
    id = data.id;
  }
  const template: SizeTemplate = { id: id!, ...payload };

  const { data: cats } = await db.from("categories").select("id").eq("size_template_id", id);
  const catIds = (cats ?? []).map((c: any) => c.id);
  if (!catIds.length) return;
  const { data: items } = await db
    .from("menu_items")
    .select("id, pizza_sizes")
    .in("category", catIds)
    .eq("ignore_size_template", false);
  for (const it of items ?? []) {
    const sizes = applyTemplateToSizes(template, (it.pizza_sizes ?? []) as PizzaSize[]);
    await db.from("menu_items").update({ pizza_sizes: sizes }).eq("id", it.id);
  }
};

export const deleteSizeTemplate = async (id: string): Promise<void> => {
  const { error } = await db.from("size_templates").delete().eq("id", id);
  if (error) throw error;
};
