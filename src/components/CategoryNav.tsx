import React, { useEffect, useRef, useState } from "react";
import { Category } from "@/types/menu";
import { cn } from "@/lib/utils";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";

interface CategoryNavProps {
  categories: Category[];
  activeCategory: string;
  onSelectCategory: (categoryId: string) => void;
}

const CategoryNav: React.FC<CategoryNavProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
}) => {
  const { settings } = useLayoutSettings();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [isStuck, setIsStuck] = useState(false);
  const [appIsDark, setAppIsDark] = useState(false);

  // Detecta o tema global do app (classe "dark" no <html>)
  useEffect(() => {
    const root = document.documentElement;
    const update = () => setAppIsDark(root.classList.contains("dark"));
    update();
    const mo = new MutationObserver(update);
    mo.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  // Detecta o estado sticky via IntersectionObserver com sentinela
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { threshold: 0, rootMargin: "0px" }
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    const btn = buttonRefs.current[activeCategory];
    if (!container || !btn) return;
    const target = btn.offsetLeft - container.clientWidth / 2 + btn.clientWidth / 2;
    container.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [activeCategory]);

  // Tema invertido apenas para o menu quando fixado
  const inverted = isStuck;
  const invertedIsDark = inverted ? !appIsDark : appIsDark;

  const containerBg = inverted
    ? invertedIsDark
      ? "#111111"
      : "#ffffff"
    : settings.cor_barra_menu_categorias;

  return (
    <>
      {/* Sentinela para detectar o momento em que o menu gruda no topo */}
      <div ref={sentinelRef} aria-hidden className="h-px w-full" />

      <div
        data-stuck={isStuck ? "true" : "false"}
        className={cn(
          "sticky top-0 z-50 w-full transition-colors duration-300",
          isStuck ? "shadow-lg" : "shadow-md"
        )}
        style={{ backgroundColor: containerBg }}
      >
        <div 
          ref={scrollRef}
          className="overflow-x-auto px-4 py-1 md:py-2 flex items-center space-x-3 md:space-x-5"
          style={{
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            .overflow-x-auto::-webkit-scrollbar {
              display: none !important;
              width: 0 !important;
              height: 0 !important;
            }
          `}} />

          {categories.map((category) => {
            const isActive = activeCategory === category.id;

            let color: string | undefined;
            let backgroundColor: string | undefined;
            let boxShadow: string | undefined;

            if (inverted) {
              // Alto contraste em relação ao fundo invertido do menu
              if (isActive) {
                color = invertedIsDark ? "#111111" : "#ffffff";
                backgroundColor = settings.cor_destaque_categoria_ativa;
                boxShadow = `0 0 8px ${settings.cor_destaque_categoria_ativa}80`;
              } else {
                color = invertedIsDark ? "#f5f5f5" : "#111111";
                backgroundColor = invertedIsDark
                  ? "rgba(255,255,255,0.10)"
                  : "rgba(0,0,0,0.06)";
              }
            } else {
              color = isActive ? settings.cor_fonte_categoria_ativa : settings.cor_fonte_menu_categorias;
              backgroundColor = isActive ? settings.cor_destaque_categoria_ativa : settings.cor_fundo_item_menu_categorias;
              boxShadow = isActive ? `0 0 8px ${settings.cor_destaque_categoria_ativa}80` : undefined;
            }


            return (
              <button
                key={category.id}
                ref={(el) => { buttonRefs.current[category.id] = el; }}
                onClick={() => onSelectCategory(category.id)}
                className={cn(
                  "food-category whitespace-nowrap hover:opacity-80 px-3 py-1.5 rounded-full text-[11px] md:text-xs font-semibold",
                  "transition-colors duration-300",
                  isActive && "active"
                )}
                style={{ color, backgroundColor, boxShadow }}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default CategoryNav;
