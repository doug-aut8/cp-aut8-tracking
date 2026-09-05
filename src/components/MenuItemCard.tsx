import React, { useState, useEffect, useMemo } from "react";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { MenuItem, Variation, SelectedVariationGroup, PizzaBorder, PizzaSize } from "@/types/menu";
import { useCart } from "@/contexts/CartContext";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { PlusCircle } from "lucide-react";
import ProductVariationDialog from "./ProductVariationDialog";
import PizzaCombinationDialog from "./PizzaCombinationDialog";
import QuantityDialog from "./QuantityDialog";
import SubmenuDialog from "./SubmenuDialog";
import { getAllVariations } from "@/services/variationService";
import { getAllMenuItems } from "@/services/menuItemService";
import { trackViewContent } from "@/utils/trackingEvents";
import ProductDetailModal from "./ProductDetailModal";

interface MenuItemCardProps {
  item: MenuItem;
  isTwoColumns?: boolean;
  priority?: boolean;
}

const isOutOfStock = (item: MenuItem) => item.stock !== null && item.stock <= 0;
const isUnavailable = (item: MenuItem) => item.available === false || isOutOfStock(item);
const minPriceOf = (i: MenuItem) => {
  const sizes = i.pizzaSizes || [];
  return sizes.length > 0 ? Math.min(...sizes.map((s) => s.price)) : i.price;
};

const MenuItemCard = React.forwardRef<{ triggerClick: () => void }, MenuItemCardProps>(({ item, isTwoColumns: isTwoColumnsProp, priority = false }, ref) => {
  const { addToCart, addItem } = useCart();
  const { settings } = useLayoutSettings();
  const isTwoColumns = isTwoColumnsProp ?? settings.layout_colunas_mobile === '2';
  const [isVariationDialogOpen, setIsVariationDialogOpen] = useState(false);
  const [isPizzaDialogOpen, setIsPizzaDialogOpen] = useState(false);
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isSubmenuOpen, setIsSubmenuOpen] = useState(false);
  const [subItem, setSubItem] = useState<MenuItem | null>(null);
  const [linkedItems, setLinkedItems] = useState<MenuItem[]>([]);
  const [availableVariations, setAvailableVariations] = useState<Variation[]>([]);
  const [loading, setLoading] = useState(false);
  const [tempCombinedItem, setTempCombinedItem] = useState<MenuItem | null>(null);
  const [pizzaCombinationSize, setPizzaCombinationSize] = useState<PizzaSize | null>(null);
  const [pizzaBaseItem, setPizzaBaseItem] = useState<MenuItem | null>(null);

  const submenuIds = item.submenuItemIds || [];
  const hasSubmenu = submenuIds.length > 0;

  useEffect(() => {
    const loadVariations = async () => {
      try {
        setLoading(true);
        const variations = await getAllVariations();
        setAvailableVariations(variations);
      } catch (error) {
        console.error("Error loading variations:", error);
        setAvailableVariations([]);
      } finally {
        setLoading(false);
      }
    };

    loadVariations();
  }, [item.id]);

  // Carrega os itens vinculados ao submenu
  useEffect(() => {
    if (!hasSubmenu) {
      setLinkedItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const all = await getAllMenuItems();
        if (cancelled) return;
        const linked = submenuIds
          .map((id) => all.find((i) => i.id === id))
          .filter((i): i is MenuItem => !!i && !isUnavailable(i));
        setLinkedItems(linked);
      } catch (e) {
        console.error("Erro ao carregar itens do submenu:", e);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, submenuIds.join(",")]);

  // Item ativo no fluxo de customização (item principal, variação do submenu ou combinação)
  const flowItem = tempCombinedItem || subItem || item;

  const groups = useMemo(() => {
    const result: { [groupId: string]: Variation[] } = {};
    if (flowItem.hasVariations && flowItem.variationGroups) {
      for (const group of flowItem.variationGroups) {
        if (!group) continue;
        result[group.id] = group.variations
          .map((varId) => availableVariations.find((v) => v.id === varId))
          .filter((variation): variation is Variation =>
            !!variation &&
            variation.available &&
            variation.categoryIds.includes(flowItem.category)
          );
      }
    }
    return result;
  }, [flowItem, availableVariations]);

  const track = (target: MenuItem) =>
    trackViewContent({
      id: target.id,
      name: target.name,
      price: target.price,
      category: target.category,
      tipo: target.tipo,
      permiteCombinacao: target.permiteCombinacao,
    });

  const openFlowFor = (target: MenuItem) => {
    const hasGroups = !!(target.hasVariations && target.variationGroups && target.variationGroups.length > 0);
    const hasBordersOnly = target.tipo === "pizza" && !!target.pizzaBorders?.some((b) => b.available !== false);
    if (hasGroups || hasBordersOnly) {
      setIsVariationDialogOpen(true);
    } else {
      setIsQuantityDialogOpen(true);
    }
  };

  const handleButtonClick = () => {
    if (isUnavailable(item)) return;
    track(item);

    if (hasSubmenu) {
      setSubItem(null);
      setTempCombinedItem(null);
      setIsSubmenuOpen(true);
      return;
    }

    openFlowFor(item);
  };

  const handleSelectSubItem = (linked: MenuItem) => {
    track(linked);
    setIsSubmenuOpen(false);
    setSubItem(linked);
    openFlowFor(linked);
  };

  const backToSubmenu = () => {
    setIsVariationDialogOpen(false);
    setIsQuantityDialogOpen(false);
    setSubItem(null);
    setTempCombinedItem(null);
    setIsSubmenuOpen(true);
  };

  const closeFlow = () => {
    setIsVariationDialogOpen(false);
    setTempCombinedItem(null);
    setSubItem(null);
  };

  React.useImperativeHandle(ref, () => ({
    triggerClick: () => {
      if (!isUnavailable(item)) handleButtonClick();
    },
  }));

  const handleAddItemWithVariations = (
    itemWithQty: MenuItem & { quantity?: number; selectedSize?: PizzaSize },
    selectedVariationGroups: SelectedVariationGroup[],
    selectedBorder?: PizzaBorder | null
  ) => {
    addItem({
      ...itemWithQty,
      selectedVariations: selectedVariationGroups,
      selectedBorder: selectedBorder || undefined,
      selectedSize: itemWithQty.selectedSize,
    });
    setTempCombinedItem(null);
    setSubItem(null);
  };

  const handleQuantityConfirm = (menuItem: MenuItem & { selectedSize?: PizzaSize }, quantity: number) => {
    addItem({ ...menuItem, quantity });
    setSubItem(null);
  };

  const handlePizzaCombination = (combinedItem: MenuItem) => {
    const hasGroups = !!(combinedItem.hasVariations && combinedItem.variationGroups && combinedItem.variationGroups.length > 0);
    const hasBorders = !!(combinedItem.pizzaBorders && combinedItem.pizzaBorders.length > 0);
    if (hasGroups || hasBorders) {
      if (!hasGroups && hasBorders) {
        combinedItem = { ...combinedItem, hasVariations: true } as MenuItem;
      }
      setTempCombinedItem(combinedItem);
      setIsPizzaDialogOpen(false);
      setPizzaBaseItem(null);
      setIsVariationDialogOpen(true);
    } else {
      addItem(combinedItem);
      setIsPizzaDialogOpen(false);
      setPizzaBaseItem(null);
      setSubItem(null);
    }
  };

  const pizzaFlowItem = pizzaBaseItem || subItem || item;
  const openPizzaCombination = (size?: PizzaSize) => {
    setPizzaBaseItem(subItem || item);
    setPizzaCombinationSize(size ?? null);
    setIsPizzaDialogOpen(true);
  };

  return (
    <>
      <div className={`food-item h-full rounded-lg overflow-hidden shadow-md p-3 sm:p-4 flex flex-col ${isUnavailable(item) ? 'opacity-50 grayscale' : ''}`} style={{ backgroundColor: settings.cor_background_header, color: settings.cor_fonte }} data-product-id={item.id}>
        <div
          className={`aspect-[4/3] overflow-hidden rounded-md mb-3 ${isUnavailable(item) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          onClick={() => {
            if (isUnavailable(item)) return;
            handleButtonClick();
          }}

        >
          <img
            src={item.image}
            alt={item.name}
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "low"}
            decoding="async"
            width="400"
            height="300"
            className="w-full h-full object-cover transition-transform hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
        </div>
        <div>
          <h3 className="text-sm sm:text-lg font-bold mb-1 line-clamp-2" style={{ color: settings.cor_fonte_titulo_produto }}>{item.name}</h3>
          <p className="text-xs sm:text-sm mb-2 sm:mb-3 line-clamp-2 sm:line-clamp-3" style={{ color: settings.cor_fonte_descricao_produto }}>{item.description}</p>
        </div>
        <div className={`flex items-center mt-auto pt-2 ${isTwoColumns ? 'flex-col gap-2' : 'justify-between flex-row'}`}>
          <div className="flex flex-col items-start">
            {item.freteGratis && <span className="text-xs font-semibold text-green-600 mb-1">🚚 Frete Grátis</span>}
            {(() => {
              const sizes = item.pizzaSizes || [];
              const hasSizes = sizes.length > 0;
              const submenuMin = hasSubmenu && linkedItems.length > 0
                ? Math.min(...linkedItems.map(minPriceOf))
                : null;
              const displayPrice = submenuMin ?? (hasSizes ? Math.min(...sizes.map((s) => s.price)) : item.price);
              const showFrom = submenuMin !== null || item.priceFrom || hasSizes;
              return (
                <>
                  {showFrom && <span className="text-xs text-gray-500 mb-1">a partir de</span>}
                  <span className={`font-bold text-brand ${isTwoColumns ? 'text-base' : 'text-base sm:text-2xl'}`}>{formatCurrency(displayPrice)}</span>
                </>
              );
            })()}
          </div>
          <Button
            onClick={handleButtonClick}
            className={`add-to-cart-btn ${isTwoColumns ? '!text-xs !px-2 !py-1 !min-h-0 !h-7 w-full' : ''}`}
            size="sm"
            disabled={loading || isUnavailable(item) || (!hasSubmenu && item.hasVariations && Object.keys(groups).length === 0)}
          >
            <PlusCircle className={`mr-1 ${isTwoColumns ? 'h-3 w-3' : 'h-4 w-4'}`} />
            {isOutOfStock(item) ? 'Esgotado' : (item.available === false ? 'Indisponível' : 'Adicionar')}
          </Button>
        </div>
      </div>

      {/* Etapa 1: submenu de itens relacionados */}
      {hasSubmenu && (
        <SubmenuDialog
          item={item}
          linkedItems={linkedItems}
          isOpen={isSubmenuOpen}
          onClose={() => setIsSubmenuOpen(false)}
          onSelect={handleSelectSubItem}
        />
      )}

      {/* Fluxo pizza meio a meio */}
      {pizzaFlowItem.tipo === "pizza" && pizzaFlowItem.permiteCombinacao && (
        <PizzaCombinationDialog
          item={pizzaFlowItem}
          isOpen={isPizzaDialogOpen}
          selectedSize={pizzaCombinationSize}
          onClose={() => { setIsPizzaDialogOpen(false); setPizzaBaseItem(null); }}
          onAddToCart={handlePizzaCombination}
        />
      )}

      {/* Etapa 2: fluxo de customização (variações, bordas, tamanhos) */}
      <ProductVariationDialog
        item={flowItem}
        isOpen={isVariationDialogOpen}
        onClose={closeFlow}
        onAddToCart={handleAddItemWithVariations}
        availableVariations={availableVariations}
        groupVariations={groups}
        onOpenPizzaCombination={openPizzaCombination}
        onBack={hasSubmenu && subItem ? backToSubmenu : undefined}
      />
      <QuantityDialog
        item={subItem || item}
        isOpen={isQuantityDialogOpen}
        onClose={() => { setIsQuantityDialogOpen(false); setSubItem(null); }}
        onConfirm={handleQuantityConfirm}
        onOpenPizzaCombination={openPizzaCombination}
        onBack={hasSubmenu && subItem ? backToSubmenu : undefined}
      />
      <ProductDetailModal
        item={item}
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        onAddToCart={() => {
          setIsDetailModalOpen(false);
          handleButtonClick();
        }}
      />
    </>
  );
});

MenuItemCard.displayName = "MenuItemCard";

export default MenuItemCard;
