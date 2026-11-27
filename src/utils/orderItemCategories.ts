import { supabase } from "@/integrations/supabase/client";
import { Order, OrderItem } from "@/types/order";

const UNCATEGORIZED_LABEL = "Outros";

type Maps = {
  itemToCategory: Record<string, string>;
  categoryNames: Record<string, string>;
};

let cache: Maps | null = null;
let cachedAt = 0;
let inflight: Promise<Maps> | null = null;
const TTL_MS = 60_000;

/** Busca (com cache) o mapa de produto -> categoria e id da categoria -> nome. */
export const getCategoryMaps = async (): Promise<Maps> => {
  const now = Date.now();
  if (cache && now - cachedAt < TTL_MS) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from("menu_items").select("id, category"),
      supabase.from("categories").select("id, name"),
    ]);

    const itemToCategory: Record<string, string> = {};
    (itemsRes.data ?? []).forEach((row: any) => {
      if (row?.id) itemToCategory[String(row.id)] = String(row.category ?? "");
    });

    const categoryNames: Record<string, string> = {};
    (catsRes.data ?? []).forEach((row: any) => {
      if (row?.id) categoryNames[String(row.id)] = String(row.name ?? row.id);
    });

    const maps = { itemToCategory, categoryNames };
    cache = maps;
    cachedAt = Date.now();
    return maps;
  })()
    .catch(() => ({ itemToCategory: {}, categoryNames: {} }))
    .finally(() => {
      inflight = null;
    });

  return inflight;
};

/** Preenche categoria/nome da categoria em cada item do pedido. */
export const enrichOrderWithCategories = async (order: Order): Promise<Order> => {
  const { itemToCategory, categoryNames } = await getCategoryMaps();

  const items = (order.items ?? []).map((item) => {
    const raw =
      item.category ||
      (item.menuItemId ? itemToCategory[String(item.menuItemId)] : "") ||
      "";
    const categoryName =
      item.categoryName || (raw ? categoryNames[raw] ?? raw : UNCATEGORIZED_LABEL);
    return { ...item, category: raw || undefined, categoryName };
  });

  return { ...order, items };
};

export type OrderItemGroup = {
  key: string;
  name: string;
  items: OrderItem[];
};

/** Agrupa os itens do pedido sob o mesmo título de categoria, preservando a ordem de chegada. */
export const groupOrderItemsByCategory = (items: OrderItem[]): OrderItemGroup[] => {
  const groups: OrderItemGroup[] = [];
  const index: Record<string, OrderItemGroup> = {};

  (items ?? []).forEach((item) => {
    const name = (item.categoryName || item.category || UNCATEGORIZED_LABEL).trim();
    const key = name.toLowerCase();
    if (!index[key]) {
      index[key] = { key, name, items: [] };
      groups.push(index[key]);
    }
    index[key].items.push(item);
  });

  return groups;
};
