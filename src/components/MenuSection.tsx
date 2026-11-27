
import React from "react";
import { Category, MenuItem } from "@/types/menu";
import MenuItemCard from "./MenuItemCard";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { useCategoryColors } from "@/hooks/useCategoryColors";

interface MenuSectionProps {
  title: string;
  categoryId?: string;
  category?: Category;
  items: MenuItem[];
  itemRefs?: React.MutableRefObject<Record<string, { triggerClick: (targetSubItemId?: string) => void } | null>>;
  priority?: boolean;
  variant?: "card" | "list";
}

const MenuSection: React.FC<MenuSectionProps> = ({ title, categoryId, category, items, itemRefs, priority = false, variant = "card" }) => {
  const { settings } = useLayoutSettings();
  const { getColors } = useCategoryColors();

  const visibleItems = items.filter((i) => !i.hiddenInMenu);

  if (visibleItems.length === 0) {
    return null;
  }

  const catColors = categoryId ? getColors(categoryId) : null;

  // Resolução do número de colunas no mobile:
  // 1) Override da categoria (1 ou 2)
  // 2) Configuração global (settings.layout_colunas_mobile)
  const categoryColumns = category?.columnsMobile;
  const effectiveMobileColumns =
    categoryColumns === 1 || categoryColumns === 2
      ? categoryColumns
      : settings.layout_colunas_mobile === '2'
        ? 2
        : 1;

  const isTwoColumns = effectiveMobileColumns === 2;

  // Altura mínima reservada por LINHA (e não por item), para que sobra de
  // espaço vertical não estique os cards quando há 2 ou 4 produtos.
  const rows = isTwoColumns ? Math.ceil(visibleItems.length / 2) : visibleItems.length;
  const reservedRows = Math.min(rows, isTwoColumns ? 2 : 4);

  return (
    <div className="mb-12">
      <h2
        className="block w-full text-center text-xl md:text-2xl font-extrabold tracking-tight mb-5 px-4 py-3 rounded-xl shadow-sm"
        style={{
          color: catColors?.fontColor || settings.cor_fonte_titulos,
          backgroundColor: catColors?.bgColor || 'transparent',
        }}
        id={categoryId ? `cat-section-${categoryId}` : title.toLowerCase().replace(/\s+/g, '-')}
        data-category-id={categoryId}
      >
        {title}
      </h2>

      {variant === "list" ? (
        <div className="rounded-xl px-3" style={{ backgroundColor: settings.cor_background_cards }}>
          {visibleItems.map((item) => (
            <MenuItemCard key={item.id} item={item} variant="list" ref={(h) => { if (itemRefs) itemRefs.current[item.id] = h; }} />
          ))}
        </div>
      ) : (
      <div
        className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${isTwoColumns ? 'grid-cols-2' : 'grid-cols-1'}`}
        style={{ minHeight: reservedRows * (isTwoColumns ? 180 : 140), alignContent: 'start' }}
      >
        {visibleItems.map((item, idx) => (
          <MenuItemCard
            key={item.id}
            item={item}
            isTwoColumns={isTwoColumns}
            priority={priority && idx < 2}
            ref={(handle) => {
              if (itemRefs) {
                itemRefs.current[item.id] = handle;
              }
            }}
          />
        ))}
      </div>
      )}
    </div>
  );
};

export default MenuSection;

