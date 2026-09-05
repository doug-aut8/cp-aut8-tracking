
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
  itemRefs?: React.MutableRefObject<Record<string, { triggerClick: () => void } | null>>;
  priority?: boolean;
}

const MenuSection: React.FC<MenuSectionProps> = ({ title, categoryId, category, items, itemRefs, priority = false }) => {
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

      <div
        className={`grid gap-4 md:grid-cols-2 lg:grid-cols-3 ${isTwoColumns ? 'grid-cols-2' : 'grid-cols-1'}`}
        style={{ minHeight: Math.min(visibleItems.length, 4) * (isTwoColumns ? 180 : 140) }}
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
    </div>
  );
};

export default MenuSection;

