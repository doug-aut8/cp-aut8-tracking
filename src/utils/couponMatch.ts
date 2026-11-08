// Verifica se um item do carrinho atende a um requisito do cupom "compre e ganhe".
// Requisitos por categoria podem listar várias categorias (category_ids); o campo
// legado category_id é mantido como fallback para cupons antigos.
export function itemMatchesRequirement(item: any, req: any): boolean {
  if (!item || !req) return false;
  if (req.tipo !== "categoria") return item.id === req.product_id;
  const ids: string[] = [
    ...(Array.isArray(req.category_ids) ? req.category_ids : []),
    ...(req.category_id ? [req.category_id] : []),
  ].filter(Boolean);
  if (!ids.length) return false;
  const itemCats: string[] = [
    item.category,
    ...(Array.isArray(item.additionalCategories) ? item.additionalCategories : []),
    ...(Array.isArray(item.additional_categories) ? item.additional_categories : []),
  ].filter(Boolean);
  return itemCats.some((c) => ids.includes(c));
}

// Modo de concessão do brinde: "por_pedido" entrega a quantidade configurada uma
// única vez por pedido; "acumulativo" multiplica a cada X itens exigidos.
// Cupons antigos sem o campo continuam acumulativos.
export type GiftConcessao = "por_pedido" | "acumulativo";

export function computeGiftCycles(items: any[], requeridos: any[], concessao?: GiftConcessao | null): number {
  const elegiveis = (items || []).filter((i: any) => !String(i?.id).startsWith("gift-"));
  let ciclos: number;
  if (!requeridos?.length) {
    ciclos = 1;
  } else {
    let melhor = -1;
    for (const req of requeridos) {
      const q = Number(req?.quantidade) || 0;
      if (q <= 0) continue;
      const total = elegiveis
        .filter((i: any) => itemMatchesRequirement(i, req))
        .reduce((s: number, i: any) => s + (i.quantity || 0), 0);
      melhor = Math.max(melhor, Math.floor(total / q));
    }
    ciclos = Math.max(0, melhor);
  }
  return concessao === "por_pedido" ? Math.min(ciclos, 1) : ciclos;
}
