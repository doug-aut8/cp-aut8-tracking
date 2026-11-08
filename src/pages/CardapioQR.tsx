import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAllMenuItems } from "@/services/menuItemService";
import { getAllCategories } from "@/services/categoryService";
import { MenuItem, Category, POPULAR_CATEGORY_ID } from "@/types/menu";
import CategoryNav from "@/components/CategoryNav";
import MenuSection from "@/components/MenuSection";
import TableBadge from "@/components/TableBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, ShoppingBag, Pizza } from "lucide-react";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { useCart } from "@/contexts/CartContext";
import { useHalfPizza } from "@/contexts/HalfPizzaContext";
import { formatCurrency } from "@/lib/utils";
import { formatTableNumber, getStoredTable, setStoredTable, useTableSettings } from "@/hooks/useTableSettings";

const CardapioQR = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { settings } = useLayoutSettings();
  const { settings: tableSettings, loading: tsLoading } = useTableSettings();
  const { itemCount, finalTotal } = useCart();
  const { firstHalf, cancelHalfPizza } = useHalfPizza();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [mesa, setMesa] = useState<string | null>(() => {
    const q = searchParams.get("mesa");
    return q ? formatTableNumber(q) : getStoredTable();
  });
  const itemRefs = useRef<Record<string, { triggerClick: (id?: string) => void } | null>>({});
  const isProgrammaticScroll = useRef(false);
  const scrollReleaseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (mesa) setStoredTable(mesa);
    if (searchParams.get("mesa")) {
      searchParams.delete("mesa");
      setSearchParams(searchParams, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesa]);

  useEffect(() => {
    (async () => {
      try {
        const [items, cats] = await Promise.all([getAllMenuItems(), getAllCategories()]);
        setMenuItems(items.filter((i) => i.available !== false || (i.stock !== null && i.stock <= 0)));
        const visible = cats.filter((c) => c.visible !== false);
        setCategories(visible);
        if (visible[0]) setActiveCategory(visible[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const grouped = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const filtered = menuItems
      .filter((i) => !term || i.name.toLowerCase().includes(term) || i.description?.toLowerCase().includes(term))
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name, "pt-BR"));
    return categories.reduce((acc, category) => {
      const items = filtered.filter((i) =>
        category.id === POPULAR_CATEGORY_ID ? i.popular : i.category === category.id || (i.additionalCategories || []).includes(category.id)
      );
      if (items.length) acc.push({ category, items });
      return acc;
    }, [] as { category: Category; items: MenuItem[] }[]);
  }, [menuItems, categories, searchTerm]);

  useEffect(() => {
    const trackedCategories = grouped.filter(({ category }) => category.showInCategoryNav !== false);
    if (trackedCategories.length === 0) return;

    const updateActiveCategory = () => {
      if (isProgrammaticScroll.current) return;

      const stickyNav = document.querySelector<HTMLElement>("[data-stuck]");
      const activationLine = Math.max(
        (stickyNav?.getBoundingClientRect().height ?? 0) + 24,
        window.innerHeight * 0.3,
      );
      let visibleCategory = trackedCategories[0].category.id;

      for (const { category } of trackedCategories) {
        const section = document.getElementById(`cat-section-${category.id}`);
        if (!section) continue;
        if (section.getBoundingClientRect().top <= activationLine) {
          visibleCategory = category.id;
        } else {
          break;
        }
      }

      const reachedPageEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (reachedPageEnd) {
        visibleCategory = trackedCategories[trackedCategories.length - 1].category.id;
      }

      setActiveCategory((current) => current === visibleCategory ? current : visibleCategory);
    };

    updateActiveCategory();
    window.addEventListener("scroll", updateActiveCategory, { passive: true });
    window.addEventListener("resize", updateActiveCategory);

    return () => {
      window.removeEventListener("scroll", updateActiveCategory);
      window.removeEventListener("resize", updateActiveCategory);
    };
  }, [grouped]);

  useEffect(() => () => {
    if (scrollReleaseTimer.current !== null) {
      window.clearTimeout(scrollReleaseTimer.current);
    }
  }, []);

  const scrollTo = (id: string) => {
    isProgrammaticScroll.current = true;
    setActiveCategory(id);
    const el = document.getElementById(`cat-section-${id}`);
    const stickyNav = document.querySelector<HTMLElement>("[data-stuck]");
    const offset = (stickyNav?.getBoundingClientRect().height ?? 0) + 12;
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior: "smooth" });

    if (scrollReleaseTimer.current !== null) {
      window.clearTimeout(scrollReleaseTimer.current);
    }
    scrollReleaseTimer.current = window.setTimeout(() => {
      isProgrammaticScroll.current = false;
      scrollReleaseTimer.current = null;
    }, 800);
  };

  if (!tsLoading && !tableSettings.mesas_ativo) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <p className="text-lg font-semibold">Os pedidos pela mesa estão desativados no momento. Chame um garçom.</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: settings.cor_background, color: settings.cor_fonte, minHeight: "100vh" }} className="pb-28">
      <TableBadge mesa={mesa} />

      <CategoryNav
        categories={grouped.map(({ category }) => category).filter((category) => category.showInCategoryNav !== false)}
        activeCategory={activeCategory}
        onSelectCategory={scrollTo}
        beforeNav={
          <div className="px-4 py-2">
            <div className="relative w-full max-w-3xl mx-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Busque por nome ou ingredientes..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 pr-9 h-10 bg-card" />
              {searchTerm && <X onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 cursor-pointer text-muted-foreground" />}
            </div>
          </div>
        }
      />

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {loading ? (
          <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 rounded bg-muted animate-pulse" />)}</div>
        ) : (
          grouped.map(({ category, items }) => (
            <MenuSection key={category.id} title={category.name} categoryId={category.id} category={category} items={items} itemRefs={itemRefs} variant="list" />
          ))
        )}
      </div>

      {firstHalf && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md flex items-center gap-3 rounded-xl border-2 border-primary bg-card px-4 py-3 shadow-2xl">
          <Pizza className="h-5 w-5 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Escolha a outra metade</p>
            <p className="text-xs text-muted-foreground truncate">1ª metade: {firstHalf.item.name}</p>
          </div>
          <button type="button" onClick={cancelHalfPizza} aria-label="Cancelar meio a meio"><X className="h-4 w-4" /></button>
        </div>
      )}

      {itemCount > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-50 p-3 bg-background/95 border-t shadow-lg">
          <Button className="w-full max-w-3xl mx-auto flex h-12 justify-between text-base" onClick={() => navigate("/checkout-mesa")}>
            <span className="flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> Ver pedido ({itemCount})</span>
            <span className="font-bold">{formatCurrency(finalTotal)}</span>
          </Button>
        </div>
      )}
    </div>
  );
};

export default CardapioQR;
