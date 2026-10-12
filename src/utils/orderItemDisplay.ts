type HalfPizzaDisplayItem = {
  name?: string;
  isHalfPizza?: boolean;
  selectedSize?: { name?: string } | null;
  combination?: {
    sabor1?: { name?: string } | null;
    sabor2?: { name?: string } | null;
    tamanho?: string;
    size?: { name?: string } | null;
  } | null;
};

export const getOrderItemDisplayName = (item: HalfPizzaDisplayItem): string => {
  if (!item.isHalfPizza || !item.combination) {
    const baseName = item.name ?? "";
    const size = item.selectedSize?.name?.trim();
    return size ? `${baseName} (${size})` : baseName;
  }

  const firstFlavor = item.combination.sabor1?.name?.trim();
  const secondFlavor = item.combination.sabor2?.name?.trim();
  if (!firstFlavor || !secondFlavor) return item.name ?? "";

  const size =
    item.combination.size?.name?.trim() ||
    item.selectedSize?.name?.trim() ||
    item.combination.tamanho?.trim();
  const sizeLabel = size ? ` (${size})` : "";

  return `1/2 ${firstFlavor} + 1/2 ${secondFlavor}${sizeLabel}`;
};