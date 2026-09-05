import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { CartItem, MenuItem, SelectedVariationGroup, PizzaBorder, PizzaSize } from "@/types/menu";
import { toast } from "@/components/ui/use-toast";
import { getAllVariations } from "@/services/variationService";
import { getAllMenuItems } from "@/services/menuItemService";
import { trackAddToCart, trackRemoveFromCart, trackUpdateCartQuantity } from "@/utils/trackingEvents";
import {
  showPromoRequirementsToast,
  dismissPromoRequirementsToast,
} from "@/utils/promoRequirementsToast";
import { dismissCouponToast } from "@/utils/couponToast";

interface ProdutoRef {
  // tipo: "produto" exige um produto específico; "categoria" exige qualquer item de uma categoria
  tipo?: "produto" | "categoria";
  product_id: string;
  product_name: string;
  // Quando tipo === "categoria", category_id/name identificam a categoria exigida
  category_id?: string;
  category_name?: string;
  quantidade: number;
  // Apenas para produto_brinde: modo "escolha" permite oferecer várias opções
  // ao cliente, que escolhe uma delas como brinde.
  modo?: "fixo" | "escolha";
  opcoes?: { product_id: string; product_name: string }[];
}

interface AppliedCoupon {
  id: string;
  nome: string;
  tipo: "percentual" | "fixo" | "frete_gratis" | "compre_e_ganhe";
  valor: number;
  descricao?: string | null;
  usos?: number | null;
  limite_uso?: number | null;
  data_inicio?: string;
  data_fim?: string;
  produtos_requeridos?: ProdutoRef[] | null;
  produto_brinde?: ProdutoRef | null;
  primeira_compra_apenas?: boolean | null;
  // Escolha do cliente quando produto_brinde.modo === "escolha" (legado — uma única escolha)
  brinde_escolhido?: { product_id: string; product_name: string } | null;
  // Escolha do cliente quando produto_brinde.modo === "escolha" e quantidade > 1:
  // permite distribuir a quantidade total entre várias opções
  brindes_escolhidos?: { product_id: string; product_name: string; quantidade: number }[] | null;
}


// Marca itens adicionados como brinde via cupom
const BRINDE_FLAG = "__couponGiftId" as const;

interface CartContextType {
  cartItems: CartItem[];
  addItem: (item: MenuItem & { selectedVariations?: SelectedVariationGroup[]; selectedBorder?: PizzaBorder; selectedSize?: PizzaSize; quantity?: number }) => void;
  addToCart: (item: MenuItem) => void;
  removeFromCart: (id: string) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  updateCartItemByIndex: (index: number, updatedItem: Partial<CartItem>) => void;
  clearCart: () => void;
  cartTotal: number;
  itemCount: number;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  appliedCoupon: AppliedCoupon | null;
  setAppliedCoupon: (coupon: AppliedCoupon | null) => void;
  setBrindeEscolhido: (escolha: { product_id: string; product_name: string } | null) => void;
  setBrindesEscolhidos: (escolhas: { product_id: string; product_name: string; quantidade: number }[] | null) => void;
  discountAmount: number;
  finalTotal: number;
  isCouponRequirementsMet: () => boolean;
}


const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "cart_items_backup";
const COUPON_STORAGE_KEY = "cart_applied_coupon";

const saveCartToStorage = (items: CartItem[]) => {
  try {
    const minimal = items.map(item => ({
      id: item.id,
      quantity: item.quantity,
      selectedVariations: item.selectedVariations,
      selectedBorder: item.selectedBorder ? { id: item.selectedBorder.id } : undefined,
      selectedSize: item.selectedSize ? { id: item.selectedSize.id } : undefined,
      isHalfPizza: item.isHalfPizza,
      combination: item.combination,
    }));
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(minimal));
  } catch (e) {
    console.error("Erro ao salvar carrinho no localStorage:", e);
  }
};

const loadCartFromStorage = (): any[] => {
  try {
    const data = localStorage.getItem(CART_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveCouponToStorage = (coupon: AppliedCoupon | null) => {
  try {
    if (coupon) localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify(coupon));
    else localStorage.removeItem(COUPON_STORAGE_KEY);
  } catch (e) {
    console.error("Erro ao salvar cupom no localStorage:", e);
  }
};

const loadCouponFromStorage = (): AppliedCoupon | null => {
  try {
    const data = localStorage.getItem(COUPON_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartTotal, setCartTotal] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [variations, setVariations] = useState<any[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(() => loadCouponFromStorage());
  const [discountAmount, setDiscountAmount] = useState(0);
  const [finalTotal, setFinalTotal] = useState(0);
  const hasRestoredCart = useRef(false);
  const menuItemsMapRef = useRef<Map<string, any>>(new Map());
  const [menuItemsLoaded, setMenuItemsLoaded] = useState(0);

  // Carregar mapa de menu items (para resolver imagem de brindes)
  useEffect(() => {
    (async () => {
      try {
        const all = await getAllMenuItems();
        menuItemsMapRef.current = new Map(all.map((i: any) => [i.id, i]));
        setMenuItemsLoaded((n) => n + 1);
      } catch (e) {
        console.error("Erro ao carregar menu items para brindes:", e);
      }
    })();
  }, []);

  // carregar variações
  useEffect(() => {
    const loadVariations = async () => {
      try {
        const allVariations = await getAllVariations();
        setVariations(allVariations);
      } catch (error) {
        console.error("Erro ao carregar variações:", error);
      }
    };
    loadVariations();
  }, []);

  // Restaurar carrinho do localStorage com preços atualizados
  useEffect(() => {
    if (hasRestoredCart.current) return;
    hasRestoredCart.current = true;

    const restoreCart = async () => {
      const savedItems = loadCartFromStorage();
      if (!savedItems.length) return;

      try {
        const allItems = await getAllMenuItems();
        const itemsMap = new Map(allItems.map(i => [i.id, i]));

        const restoredItems: CartItem[] = [];
        for (const saved of savedItems) {
          const fresh = itemsMap.get(saved.id);
          if (!fresh || fresh.available === false) continue;

          // Restaurar borda com preço atualizado
          let restoredBorder: PizzaBorder | undefined;
          if (saved.selectedBorder?.id && fresh.pizzaBorders) {
            restoredBorder = fresh.pizzaBorders.find((b: PizzaBorder) => b.id === saved.selectedBorder.id);
          }

          // Restaurar tamanho com preço atualizado
          let restoredSize: PizzaSize | undefined;
          if (saved.selectedSize?.id && fresh.pizzaSizes) {
            restoredSize = fresh.pizzaSizes.find((s: PizzaSize) => s.id === saved.selectedSize.id);
          }

          restoredItems.push({
            ...fresh,
            price: restoredSize ? restoredSize.price : fresh.price,
            priceFrom: restoredSize ? false : fresh.priceFrom,
            quantity: saved.quantity,
            selectedVariations: saved.selectedVariations,
            selectedBorder: restoredBorder,
            selectedSize: restoredSize,
            isHalfPizza: saved.isHalfPizza,
            combination: saved.combination,
          });
        }

        if (restoredItems.length > 0) {
          setCartItems(restoredItems);
        }
        if (restoredItems.length < savedItems.length) {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([]));
        }
      } catch (error) {
        console.error("Erro ao restaurar carrinho:", error);
      }
    };

    restoreCart();
  }, []);

  // Salvar carrinho no localStorage quando mudar
  useEffect(() => {
    saveCartToStorage(cartItems);
  }, [cartItems]);

  // Persistir cupom aplicado
  useEffect(() => {
    saveCouponToStorage(appliedCoupon);
  }, [appliedCoupon]);

  const getVariationPrice = (variationId: string): number => {
    const variation = variations.find(v => v.id === variationId);
    return variation?.additionalPrice || 0;
  };

  const getVariationName = (variationId: string): string => {
    const variation = variations.find(v => v.id === variationId);
    return variation?.name || "";
  };

  const calculateVariationsTotal = (item: CartItem): number => {
    let variationsTotal = 0;
    if (item.selectedVariations?.length) {
      item.selectedVariations.forEach(group => {
        group.variations?.forEach(variation => {
          const additionalPrice = variation.additionalPrice ?? getVariationPrice(variation.variationId);
          if (additionalPrice > 0) {
            // Se é pizza meio a meio e selecionou "whole" (pizza inteira), cobra 2x
            const multiplier = (item.isHalfPizza && variation.halfSelection === "whole") ? 2 : 1;
            variationsTotal += additionalPrice * (variation.quantity || 1) * multiplier;
          }
        });
      });
    }
    // Adicionar preço da borda selecionada
    if (item.selectedBorder?.additionalPrice) {
      variationsTotal += item.selectedBorder.additionalPrice;
    }
    return variationsTotal;
  };

  // Helper para identificar itens brinde
  const isGiftItem = (item: any): boolean => !!item?.[BRINDE_FLAG];

  // recalcular totais
  useEffect(() => {
    const { total, count } = cartItems.reduce(
      (acc, item) => {
        // Item brinde: nunca soma ao total
        if (isGiftItem(item)) {
          acc.count += item.quantity;
          return acc;
        }

        let itemTotal = 0;

        if (item.isHalfPizza) {
          const basePrice = item.price || 0;
          const variationsTotal = calculateVariationsTotal(item);
          itemTotal = (basePrice + variationsTotal) * item.quantity;
        } else {
          const basePrice = item.priceFrom ? 0 : (item.price || 0);
          const variationsTotal = calculateVariationsTotal(item);
          itemTotal = (basePrice + variationsTotal) * item.quantity;
        }

        acc.total += itemTotal;
        acc.count += item.quantity;
        return acc;
      },
      { total: 0, count: 0 }
    );

    setCartTotal(total);
    setItemCount(count);

    // Calcular desconto e total final
    let discount = 0;
    if (appliedCoupon) {
      if (appliedCoupon.tipo === "percentual") {
        discount = total * (appliedCoupon.valor / 100);
      } else if (appliedCoupon.tipo === "fixo") {
        discount = appliedCoupon.valor;
      }
      // frete_gratis: handled in Checkout
      // compre_e_ganhe: brinde já está com preço 0, sem desconto monetário
    }
    setDiscountAmount(discount);
    setFinalTotal(Math.max(0, total - discount));
  }, [cartItems, variations, appliedCoupon]);

  // Verifica se o carrinho satisfaz os produtos exigidos por um cupom compre_e_ganhe
  // Suporta exigência por produto específico OU por categoria (soma quantidades)
  const cartSatisfiesRequirements = (
    items: CartItem[],
    requeridos: ProdutoRef[]
  ): boolean => {
    // Sem requisitos = brinde direto (prêmio de fidelidade): sempre satisfeito
    if (!requeridos?.length) return true;
    const elegiveis = items.filter((i) => !isGiftItem(i));
    return requeridos.every((req) => {
      const ehCategoria = req.tipo === "categoria";
      const totalNoCarrinho = elegiveis
        .filter((i) =>
          ehCategoria
            ? req.category_id && i.category === req.category_id
            : i.id === req.product_id
        )
        .reduce((sum, i) => sum + (i.quantity || 0), 0);
      return totalNoCarrinho >= req.quantidade;
    });
  };

  // Calcula quantos "ciclos" completos da regra cabem no carrinho atual.
  // Ex.: regra "2 pizzas → 1 refri" + 5 pizzas = floor(5/2) = 2 ciclos.
  // Quando há múltiplos requisitos, usa o menor número de ciclos completos.
  const computeGiftMultiplier = (
    items: CartItem[],
    requeridos: ProdutoRef[]
  ): number => {
    // Sem requisitos = brinde direto (prêmio de fidelidade): 1 ciclo
    if (!requeridos?.length) return 1;
    const elegiveis = items.filter((i) => !isGiftItem(i));
    let menorCiclo = Infinity;
    for (const req of requeridos) {
      if (!req.quantidade || req.quantidade <= 0) continue;
      const ehCategoria = req.tipo === "categoria";
      const totalNoCarrinho = elegiveis
        .filter((i) =>
          ehCategoria
            ? req.category_id && i.category === req.category_id
            : i.id === req.product_id
        )
        .reduce((sum, i) => sum + (i.quantity || 0), 0);
      const ciclos = Math.floor(totalNoCarrinho / req.quantidade);
      if (ciclos < menorCiclo) menorCiclo = ciclos;
    }
    return Number.isFinite(menorCiclo) ? menorCiclo : 0;
  };

  // Resolve quais serão os brindes efetivos no total disponível (suporta modo "escolha" com múltiplas opções)
  const resolverBrindesEfetivos = (
    coupon: AppliedCoupon,
    totalDisponivel: number
  ): { product_id: string; product_name: string; quantidade: number }[] => {
    const brinde = coupon.produto_brinde;
    if (!brinde) return [];
    const totalAlvo = Math.max(0, totalDisponivel);
    if (totalAlvo <= 0) return [];

    if (brinde.modo === "escolha") {
      const opcoes = brinde.opcoes || [];
      // Nova forma: distribuição por múltiplas opções usando a quantidade total de brindes disponível
      const escolhas = coupon.brindes_escolhidos || [];
      const validas = escolhas
        .filter((e) => e.quantidade > 0 && opcoes.some((o) => o.product_id === e.product_id))
        .map((e) => ({ ...e }));
      const somaValidas = validas.reduce((s, e) => s + e.quantidade, 0);
      if (validas.length > 0 && somaValidas === totalAlvo) {
        return validas;
      }
      // Compat legado: escolha única
      const escolha = coupon.brinde_escolhido;
      if (escolha?.product_id && opcoes.some((o) => o.product_id === escolha.product_id)) {
        return [
          { product_id: escolha.product_id, product_name: escolha.product_name, quantidade: totalAlvo },
        ];
      }
      return [];
    }

    return [
      { product_id: brinde.product_id, product_name: brinde.product_name, quantidade: totalAlvo },
    ];
  };

  // Constrói os itens brinde (um por opção escolhida), usando a quantidade total a que o cliente tem direito
  const buildGiftItems = (
    coupon: AppliedCoupon,
    items: CartItem[]
  ): CartItem[] => {
    const ciclos = computeGiftMultiplier(items, coupon.produtos_requeridos || []);
    if (ciclos <= 0) return [];
    const quantidadePorCiclo = coupon.produto_brinde?.quantidade || 1;
    const totalDisponivel = quantidadePorCiclo * ciclos;
    const efetivos = resolverBrindesEfetivos(coupon, totalDisponivel);
    if (efetivos.length === 0) return [];
    return efetivos.map((ef) => {
      const mi = menuItemsMapRef.current.get(ef.product_id);
      const originalPrice = Number((mi as any)?.price ?? 0) || 0;
      return {
        id: `gift-${ef.product_id}-${coupon.id}`,
        name: `🎁 ${ef.product_name} (Brinde)`,
        description: `Brinde do cupom ${coupon.nome}`,
        price: 0,
        image: mi?.image || "/placeholder.svg",
        category: "brinde",
        quantity: ef.quantidade || 1,
        [BRINDE_FLAG]: ef.product_id,
        __originalPrice: originalPrice,
      } as any;
    });
  };


  // Wrapper que gerencia adição/remoção do brinde
  const applyCouponInternal = (coupon: AppliedCoupon | null) => {
    setCartItems((prev) => {
      // Sempre remove brindes do cupom anterior
      const semBrindesAntigos = prev.filter((i) => !isGiftItem(i));

      if (!coupon || coupon.tipo !== "compre_e_ganhe" || !coupon.produto_brinde) {
        setAppliedCoupon(coupon);
        if (!coupon) dismissPromoRequirementsToast();
        return semBrindesAntigos;
      }

      // Mesmo que requisitos não estejam atendidos, aplicamos o cupom.
      // O toast amarelo informa ao cliente o que falta para receber o brinde.
      const atende = cartSatisfiesRequirements(semBrindesAntigos, coupon.produtos_requeridos || []);
      setAppliedCoupon(coupon);
      if (!atende) {
        dismissCouponToast();
        showPromoRequirementsToast(
          coupon.descricao?.trim() ||
            "Adicione os produtos exigidos para receber o brinde desta promoção."
        );
        return semBrindesAntigos;
      }
      dismissPromoRequirementsToast();
      const giftCartItems = buildGiftItems(coupon, semBrindesAntigos);
      return giftCartItems.length ? [...semBrindesAntigos, ...giftCartItems] : semBrindesAntigos;
    });
  };

  // Revalidar brinde quando o carrinho muda: ajusta quantidade proporcional automaticamente
  useEffect(() => {
    if (!appliedCoupon || appliedCoupon.tipo !== "compre_e_ganhe") return;
    const semBrindes = cartItems.filter((i) => !isGiftItem(i));
    const brindeAtual = cartItems.find((i) => isGiftItem(i));
    const satisfaz = cartSatisfiesRequirements(semBrindes, appliedCoupon.produtos_requeridos || []);

    if (!satisfaz) {
      if (brindeAtual) {
        setCartItems((prev) => prev.filter((i) => !isGiftItem(i)));
      }
      dismissCouponToast();
      showPromoRequirementsToast(
        appliedCoupon.descricao?.trim() ||
          "Adicione os produtos exigidos para receber o brinde desta promoção."
      );
      return;
    }
    // Requisitos atendidos — esconde o toast amarelo
    dismissPromoRequirementsToast();

    // Recalcular brindes proporcionalmente
    const novosBrindes = buildGiftItems(appliedCoupon, semBrindes);
    const brindesAtuais = cartItems.filter((i) => isGiftItem(i));

    const sig = (arr: CartItem[]) =>
      arr.map((i: any) => `${i.id}:${i.quantity}:${i.image || ""}`).sort().join("|");

    if (novosBrindes.length === 0) {
      if (brindesAtuais.length > 0) {
        setCartItems((prev) => prev.filter((i) => !isGiftItem(i)));
      }
      return;
    }

    if (sig(brindesAtuais) !== sig(novosBrindes)) {
      setCartItems((prev) => [...prev.filter((i) => !isGiftItem(i)), ...novosBrindes]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cartItems.filter((i) => !isGiftItem(i)).map((i) => `${i.id}:${i.quantity}`).join("|"),
    appliedCoupon?.id,
    appliedCoupon?.brinde_escolhido?.product_id,
    (appliedCoupon?.brindes_escolhidos || []).map((e) => `${e.product_id}:${e.quantidade}`).join("|"),
    menuItemsLoaded,
  ]);

  // Atualiza apenas a escolha do brinde no cupom já aplicado (legado, escolha única)
  const setBrindeEscolhido = (
    escolha: { product_id: string; product_name: string } | null
  ) => {
    setAppliedCoupon((prev) =>
      prev ? { ...prev, brinde_escolhido: escolha, brindes_escolhidos: null } : prev
    );
  };

  // Atualiza a distribuição de brindes (modo escolha com quantidade > 1)
  const setBrindesEscolhidos = (
    escolhas: { product_id: string; product_name: string; quantidade: number }[] | null
  ) => {
    setAppliedCoupon((prev) =>
      prev ? { ...prev, brindes_escolhidos: escolhas, brinde_escolhido: null } : prev
    );
  };


  const enrichSelectedVariations = (selectedVariations?: SelectedVariationGroup[]): SelectedVariationGroup[] => {
    if (!selectedVariations?.length) return [];
    return selectedVariations.map(group => ({
      ...group,
      variations: group.variations.map(variation => ({
        ...variation,
        name: variation.name || getVariationName(variation.variationId),
        additionalPrice:
          variation.additionalPrice !== undefined
            ? variation.additionalPrice
            : getVariationPrice(variation.variationId),
      })),
    }));
  };

  const addItem = (menuItem: MenuItem & { selectedVariations?: SelectedVariationGroup[]; selectedBorder?: PizzaBorder; selectedSize?: PizzaSize; quantity?: number }) => {
    const { selectedVariations, selectedBorder, selectedSize, quantity: inputQuantity, ...item } = menuItem;
    const quantityToAdd = inputQuantity ?? 1;

    const enrichedVariations = enrichSelectedVariations(selectedVariations);
    const itemId = item.id;

    setCartItems(prevItems => {
      const existingItem = prevItems.find(
        i =>
          i.id === itemId &&
          JSON.stringify(i.selectedVariations) === JSON.stringify(enrichedVariations) &&
          i.selectedBorder?.id === selectedBorder?.id &&
          i.selectedSize?.id === selectedSize?.id
      );

      if (existingItem) {
        return prevItems.map(i =>
          i.id === itemId &&
          JSON.stringify(i.selectedVariations) === JSON.stringify(enrichedVariations) &&
          i.selectedBorder?.id === selectedBorder?.id &&
          i.selectedSize?.id === selectedSize?.id
            ? { ...i, quantity: i.quantity + quantityToAdd }
            : i
        );
      } else {
        const newItem: CartItem = {
          ...item,
          quantity: quantityToAdd,
          selectedVariations: enrichedVariations,
          selectedBorder: selectedBorder,
          selectedSize: selectedSize,
        };
        return [...prevItems, newItem];
      }
    });

    const addedToast = toast({
      title: "Item adicionado",
      description: `${quantityToAdd}x ${item.name} foi adicionado ao carrinho`,
      duration: 2000,
    });
    setTimeout(() => addedToast.dismiss(), 2000);
    
// --- INÍCIO DO CÓDIGO DE RASTREAMENTO (ATUALIZADO) ---
    try {
      const itemParaCalculo: CartItem = { ...menuItem, quantity: quantityToAdd, selectedVariations: enrichedVariations };
      let finalPrice = 0;

      if (itemParaCalculo.isHalfPizza) {
        finalPrice = itemParaCalculo.price || 0;
      } else {
        const basePrice = itemParaCalculo.priceFrom ? 0 : (itemParaCalculo.price || 0);
        const variationsTotal = calculateVariationsTotal(itemParaCalculo);
        finalPrice = basePrice + variationsTotal;
      }

      // Montando o objeto de dados completo para a nova função
      const trackingData = {
        id: item.id,
        name: item.name,
        price: finalPrice,
        quantity: quantityToAdd,
        category: item.category,
        variations: enrichedVariations?.flatMap(group => 
          group.variations.map(v => ({ name: v.name, price: v.additionalPrice }))
        ),
        border: menuItem.selectedBorder
          ? { name: menuItem.selectedBorder.name, price: menuItem.selectedBorder.additionalPrice }
          : undefined,
        isHalfPizza: item.isHalfPizza,
        combination: item.combination,
      };

      trackAddToCart(trackingData);

    } catch (error) {
        console.error("Falha ao rastrear evento AddToCart:", error);
    }
    // --- FIM DO CÓDIGO DE RASTREAMENTO ---

  };

  const addToCart = (item: MenuItem) => addItem(item);

  const removeFromCart = (id: string) => {
    const removedItem = cartItems.find(item => item.id === id);
    if (removedItem && isGiftItem(removedItem)) {
      toast({
        title: "Brinde",
        description: "Para remover o brinde, remova o cupom aplicado.",
        variant: "destructive",
      });
      return;
    }
    if (removedItem) {
      trackRemoveFromCart({
        id: removedItem.id,
        name: removedItem.name,
        price: removedItem.price,
        quantity: removedItem.quantity,
        category: removedItem.category,
      });
    }
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  };

  const buildTrackingData = (item: CartItem, newQuantity: number) => ({
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: newQuantity,
    category: item.category,
    variations: item.selectedVariations?.flatMap(group =>
      group.variations.map(v => ({ name: v.name, price: v.additionalPrice }))
    ),
    border: item.selectedBorder
      ? { name: item.selectedBorder.name, price: item.selectedBorder.additionalPrice }
      : undefined,
    isHalfPizza: item.isHalfPizza,
    combination: item.combination,
  });

  const increaseQuantity = (id: string) => {
    const item = cartItems.find(i => i.id === id);
    if (item && isGiftItem(item)) {
      toast({
        title: "Brinde",
        description: "A quantidade do brinde é calculada automaticamente.",
        variant: "destructive",
      });
      return;
    }
    if (item) {
      trackUpdateCartQuantity(buildTrackingData(item, item.quantity + 1));
    }
    setCartItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
  };

  const decreaseQuantity = (id: string) => {
    const item = cartItems.find(i => i.id === id);
    if (item && isGiftItem(item)) {
      toast({
        title: "Brinde",
        description: "A quantidade do brinde é calculada automaticamente.",
        variant: "destructive",
      });
      return;
    }
    if (item && item.quantity > 1) {
      trackUpdateCartQuantity(buildTrackingData(item, item.quantity - 1));
    }
    setCartItems(prevItems => {
      const item = prevItems.find(i => i.id === id);
      if (!item) return prevItems;
      if (item.quantity <= 1) {
        return prevItems.filter(i => i.id !== id);
      }
      return prevItems.map(i =>
        i.id === id ? { ...i, quantity: i.quantity - 1 } : i
      );
    });
  };

  const updateCartItemByIndex = (index: number, updatedFields: Partial<CartItem>) => {
    setCartItems(prevItems =>
      prevItems.map((item, i) => {
        if (i !== index) return item;
        if (isGiftItem(item)) return item; // brindes não podem ser alterados
        // Ignorar tentativas de mudar a quantidade vinda de fora para itens normais via este método
        return { ...item, ...updatedFields };
      })
    );
  };

  const clearCart = () => {
    setCartItems([]);
    setAppliedCoupon(null);
    dismissPromoRequirementsToast();
  };

  const isCouponRequirementsMet = () => {
    if (!appliedCoupon || appliedCoupon.tipo !== "compre_e_ganhe") return true;
    const semBrindes = cartItems.filter((i) => !isGiftItem(i));
    return cartSatisfiesRequirements(semBrindes, appliedCoupon.produtos_requeridos || []);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addItem,
        addToCart,
        removeFromCart,
        increaseQuantity,
        decreaseQuantity,
        updateCartItemByIndex,
        clearCart,
        cartTotal,
        itemCount,
        isCartOpen,
        setIsCartOpen,
        appliedCoupon,
        setAppliedCoupon: applyCouponInternal,
        setBrindeEscolhido,
        setBrindesEscolhidos,
        discountAmount,
        finalTotal,
        isCouponRequirementsMet,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
};
