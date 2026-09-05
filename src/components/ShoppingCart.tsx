import React, { useState, useEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { X, Minus, Plus, ShoppingBag, Trash2, Tag, Gift } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getAllVariations, getVariationById } from "@/services/variationService";
import { Variation } from "@/types/menu";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { trackInitiateCheckout } from "@/utils/trackingEvents";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { showCouponToast, dismissCouponToast } from "@/utils/couponToast";
import { showPromoRequirementsToast, dismissPromoRequirementsToast } from "@/utils/promoRequirementsToast";
import GiftOptionsPicker from "@/components/GiftOptionsPicker";
import { getFirstPurchaseCouponBlockMessage, validateFirstPurchaseCoupon } from "@/services/couponEligibilityService";


const ShoppingCart: React.FC = () => {
  const {
    cartItems,
    removeFromCart,
    increaseQuantity,
    decreaseQuantity,
    cartTotal,
    isCartOpen,
    setIsCartOpen,
    itemCount,
    appliedCoupon,
    setAppliedCoupon,
    setBrindeEscolhido,
    setBrindesEscolhidos,

    discountAmount,
    finalTotal,
  } = useCart();
  
  
  const { currentUser } = useAuth();
  const { settings } = useLayoutSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [variations, setVariations] = useState<Variation[]>([]);

  const [variationsLoading, setVariationsLoading] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  // Load all variations when the component mounts
  useEffect(() => {
    const loadVariations = async () => {
      try {
        const allVariations = await getAllVariations();
        setVariations(allVariations);
      } catch (error) {
        console.error("Erro ao carregar variações:", error);
      } finally {
        setVariationsLoading(false);
      }
    };
    
    loadVariations();
  }, []);

  useEffect(() => {
    if (location.pathname === "/checkout") {
      dismissCouponToast();
    }
  }, [location.pathname]);

  const handleApplyCoupon = async () => {

    if (!couponCode.trim()) {
      toast({
        title: "Código inválido",
        description: "Digite um código de cupom",
        variant: "destructive",
      });
      return;
    }

    setCouponLoading(true);
    try {
      const { data: cupom, error } = await supabase
        .from("cupons" as any)
        .select("*")
        .ilike("nome", couponCode.trim())
        .maybeSingle();

      if (error || !cupom) {
        toast({
          title: "Cupom não encontrado",
          description: "Código de cupom inválido",
          variant: "destructive",
        });
        return;
      }

      const cupomData = cupom as any;

      // Validar se está ativo
      if (!cupomData.ativo) {
        toast({
          title: "Cupom inativo",
          description: "Este cupom não está mais disponível",
          variant: "destructive",
        });
        return;
      }

      // Validar data de validade
      const today = new Date();
      const dataInicio = new Date(cupomData.data_inicio);
      const dataFim = new Date(cupomData.data_fim);
      
      if (today < dataInicio || today > dataFim) {
        toast({
          title: "Cupom expirado",
          description: "Este cupom não está mais válido",
          variant: "destructive",
        });
        return;
      }

      // Validar valor mínimo do pedido
      if (cupomData.valor_minimo_pedido && cartTotal < cupomData.valor_minimo_pedido) {
        toast({
          title: "Valor mínimo não atingido",
          description: `Pedido mínimo de ${formatCurrency(cupomData.valor_minimo_pedido)} para usar este cupom`,
          variant: "destructive",
        });
        return;
      }

      // Validar limite total de uso
      if (cupomData.limite_uso !== null && cupomData.limite_uso !== undefined) {
        const { count, error: countError } = await supabase
          .from("cupons_usos" as any)
          .select("*", { count: "exact", head: true })
          .eq("cupom_id", cupomData.id);

        const totalUsos = count ?? 0;
        console.log("Validação limite total:", { limite: cupomData.limite_uso, usos: totalUsos, countError });
        
        if (totalUsos >= cupomData.limite_uso) {
          toast({
            title: "Cupom esgotado",
            description: "Este cupom atingiu o limite de uso",
            variant: "destructive",
          });
          return;
        }
      }

      // Validar usos por usuário (se estiver logado)
      if (currentUser && cupomData.usos_por_usuario !== null && cupomData.usos_por_usuario !== undefined) {
        const { data: userData } = await supabase
          .from("users" as any)
          .select("id")
          .eq("firebase_id", currentUser.uid)
          .maybeSingle();

        const userDataTyped = userData as unknown as { id: string } | null;

        if (userDataTyped && userDataTyped.id) {
          const { count, error: userCountError } = await supabase
            .from("cupons_usos" as any)
            .select("*", { count: "exact", head: true })
            .eq("cupom_id", cupomData.id)
            .eq("user_id", userDataTyped.id);

          const usosUsuario = count ?? 0;
          console.log("Validação limite por usuário:", { limite: cupomData.usos_por_usuario, usos: usosUsuario, userId: userDataTyped.id, userCountError });
          
          if (usosUsuario >= cupomData.usos_por_usuario) {
            toast({
              title: "Limite de uso atingido",
              description: "Você já usou este cupom o máximo de vezes permitido",
              variant: "destructive",
            });
            return;
          }
        }
      }

      if (cupomData.primeira_compra_apenas) {
        const validation = await validateFirstPurchaseCoupon(cupomData, currentUser);
        if (!validation.eligible) {
          toast({
            title: validation.reason === "login_required" ? "Login necessário" : "Cupom indisponível",
            description: getFirstPurchaseCouponBlockMessage(validation.reason),
            variant: "destructive",
          });
          return;
        }
      }

      // Aplicar cupom
      setAppliedCoupon({
        id: cupomData.id,
        nome: cupomData.nome,
        tipo: cupomData.tipo,
        valor: cupomData.valor,
        descricao: cupomData.descricao ?? null,
        usos: cupomData.usos,
        limite_uso: cupomData.limite_uso,
        data_inicio: cupomData.data_inicio,
        data_fim: cupomData.data_fim,
        produtos_requeridos: cupomData.produtos_requeridos ?? null,
        produto_brinde: cupomData.produto_brinde ?? null,
        primeira_compra_apenas: cupomData.primeira_compra_apenas ?? false,
      });

      const descricaoDesconto =
        cupomData.tipo === "percentual"
          ? `${cupomData.valor}%`
          : cupomData.tipo === "frete_gratis"
          ? "Frete Grátis"
          : cupomData.tipo === "compre_e_ganhe"
          ? `🎁 Brinde: ${cupomData.produto_brinde?.product_name || "produto"}`
          : formatCurrency(cupomData.valor);

      // Para "compre e ganhe" com requisitos não atendidos, o CartContext já
      // exibe um toast amarelo com os requisitos da promoção — não mostrar o verde.
      const reqs = (cupomData.produtos_requeridos || []) as any[];
      const elegiveis = cartItems.filter((i: any) => !i?.__couponGiftId);
      const reqsAtendidos =
        cupomData.tipo !== "compre_e_ganhe" ||
        (reqs.length > 0 &&
          reqs.every((req: any) => {
            const ehCategoria = req.tipo === "categoria";
            const total = elegiveis
              .filter((i: any) =>
                ehCategoria
                  ? req.category_id && i.category === req.category_id
                  : i.id === req.product_id
              )
              .reduce((s: number, i: any) => s + (i.quantity || 0), 0);
            return total >= req.quantidade;
          }));

      if (reqsAtendidos) {
        showCouponToast({
          title: "Cupom aplicado!",
          description: `Cupom aplicado: ${descricaoDesconto}`,
        });
      } else {
        dismissCouponToast();
        showPromoRequirementsToast(
          (cupomData.descricao || "").trim() ||
            "Adicione os produtos exigidos para receber o brinde desta promoção."
        );
      }

      setCouponCode("");

    } catch (error) {
      console.error("Erro ao aplicar cupom:", error);
      toast({
        title: "Erro",
        description: "Não foi possível aplicar o cupom",
        variant: "destructive",
      });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    dismissPromoRequirementsToast();
    toast({
      title: "Cupom removido",
      description: "O desconto foi removido do seu pedido",
    });
  };

  const handleCheckout = () => {
    if (!currentUser) {
      toast({
        title: "Login necessário",
        description: "Por favor, faça login para continuar com seu pedido",
        variant: "destructive",
      });
      dismissCouponToast();
      setIsCartOpen(false);
      navigate("/login?redirect=/checkout");
      return;
    }
    
    // Track InitiateCheckout
    trackInitiateCheckout(cartItems, finalTotal);

    dismissCouponToast();
    setIsCartOpen(false);
    navigate("/checkout");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  // Determine if we're on the checkout page to adjust the cart button position
  const isCheckoutPage = window.location.pathname === "/checkout";

  // Don't show the cart button on the checkout page at all
  if (isCheckoutPage) {
    return null;
  }

  // Função para obter o nome da variação a partir do ID
  const getVariationName = (variationId: string): string => {
    // Procurar a variação no estado local
    const variation = variations.find(v => v.id === variationId);
    
    if (variation) {
      return variation.name;
    }
    
    // Se não encontrar (enquanto está carregando), retornar um placeholder
    return variationsLoading ? "Carregando..." : "Variação não encontrada";
  };

  // Função para obter o preço adicional da variação
  const getVariationPrice = (variationId: string): number => {
    const variation = variations.find(v => v.id === variationId);
    return variation?.additionalPrice || 0;
  };

  // Função para calcular o valor total das variações de um item
  const calculateVariationsTotal = (item: any): number => {
    let variationsTotal = 0;
    
    if (item.selectedVariations && item.selectedVariations.length > 0) {
      item.selectedVariations.forEach((group: any) => {
        if (group.variations && group.variations.length > 0) {
          group.variations.forEach((variation: any) => {
            const additionalPrice = getVariationPrice(variation.variationId);
            if (additionalPrice > 0) {
              // Se é pizza meio a meio e selecionou "whole" (pizza inteira), cobra 2x
              const multiplier = (item.isHalfPizza && variation.halfSelection === "whole") ? 2 : 1;
              variationsTotal += additionalPrice * (variation.quantity || 1) * multiplier;
            }
          });
        }
      });
    }
    
    // Adicionar preço da borda selecionada
    if (item.selectedBorder?.additionalPrice) {
      variationsTotal += item.selectedBorder.additionalPrice;
    }
    
    return variationsTotal;
  };

  // Função para obter label da metade selecionada
  const getHalfSelectionLabel = (halfSelection?: string): string => {
    if (!halfSelection) return "";
    switch (halfSelection) {
      case "half1": return "(Metade 1)";
      case "half2": return "(Metade 2)";
      case "whole": return "(Pizza Inteira - 2x)";
      default: return "";
    }
  };

  // Função para calcular o total do item (base + variações) x quantidade
  const calculateItemTotal = (item: any): number => {
    // Para pizzas meio a meio, usar apenas o preço calculado
    if (item.isHalfPizza) {
      return item.price * item.quantity;
    }
    
    // Se o item tem "a partir de", o preço base é 0
    const basePrice = item.priceFrom ? 0 : (item.price || 0);
    const variationsTotal = calculateVariationsTotal(item);
    return (basePrice + variationsTotal) * item.quantity;
  };

  return (
    <>
      {/* Cart Trigger Button */}
      <button
        className="fixed bottom-6 right-6 z-30 w-[40%] py-3 px-4 rounded-xl shadow-lg transition-all duration-300 flex items-center justify-center gap-2"
        onClick={() => setIsCartOpen(true)}
        style={{ backgroundColor: settings.cor_botoes, color: settings.cor_fonte_botoes }}
      >
        <ShoppingBag className="h-5 w-5" />
        <span className="font-semibold text-sm">Carrinho</span>
        {itemCount > 0 && (
          <span className="bg-food-green text-xs rounded-full w-5 h-5 flex items-center justify-center" style={{ color: settings.cor_fonte_botoes }}>
            {itemCount}
          </span>
        )}
      </button>

      {/* Cart Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity",
          isCartOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsCartOpen(false)}
      ></div>

      {/* Cart Slide Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-full sm:w-96 bg-white z-50 p-6 shadow-xl overflow-y-auto transform transition-transform duration-300 ease-in-out",
          isCartOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Seu Pedido</h2>
          <button onClick={() => setIsCartOpen(false)} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        {cartItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64">
            <ShoppingBag className="h-16 w-16 text-gray-300 mb-4" />
            <p className="text-gray-500 text-center">Seu carrinho está vazio</p>
            <p className="text-gray-400 text-sm text-center mt-2">Adicione itens do menu para começar seu pedido</p>
            <Button
              className="mt-6 bg-brand hover:bg-brand-600"
              onClick={() => setIsCartOpen(false)}
            >
              Ver Menu
            </Button>

            {/* Resgatar Recompensa (cupom / fidelidade) mesmo com carrinho vazio */}
            <div className="w-full mt-8 border-t pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Gift className="h-4 w-4 text-brand" />
                <h3 className="font-semibold text-sm">Resgatar Recompensa</h3>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Tem um cupom de desconto ou prêmio de fidelidade? Insira o código abaixo para deixá-lo pronto no seu próximo pedido.
              </p>
              {appliedCoupon ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-md px-3 py-2">
                    <div className="flex items-center gap-2 text-sm text-green-800">
                      <Tag className="h-4 w-4" />
                      <span className="font-medium">{appliedCoupon.nome}</span>
                    </div>
                    <button
                      onClick={handleRemoveCoupon}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remover
                    </button>
                  </div>

                  {appliedCoupon.tipo === "compre_e_ganhe" &&
                    appliedCoupon.produto_brinde?.modo === "escolha" && (() => {
                      const requeridos = appliedCoupon.produtos_requeridos || [];
                      const ciclos = requeridos.length ? 0 : 1;
                      const totalAlvo =
                        (appliedCoupon.produto_brinde?.quantidade || 1) * Math.max(1, ciclos || 1);
                      const opcoes = appliedCoupon.produto_brinde?.opcoes || [];
                      const escolhas = appliedCoupon.brindes_escolhidos || [];
                      return (
                        <div className="bg-green-50 border border-green-200 rounded-md p-2">
                          <GiftOptionsPicker
                            opcoes={opcoes}
                            escolhas={escolhas}
                            totalAlvo={totalAlvo}
                            onChange={(novas) => setBrindesEscolhidos(novas)}
                          />
                        </div>
                      );
                    })()}
                </div>

              ) : (
                <div className="flex gap-2">
                  <Input
                    placeholder="Código do cupom"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleApplyCoupon();
                    }}
                    disabled={couponLoading}
                  />
                  <Button
                    onClick={handleApplyCoupon}
                    disabled={couponLoading || !couponCode.trim()}
                    className="bg-brand hover:bg-brand-600"
                  >
                    {couponLoading ? "..." : "Aplicar"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {cartItems.map((item) => {
                // Se o item tem "a partir de", o preço base é 0
                const basePrice = item.priceFrom ? 0 : (item.price || 0);
                const variationsTotal = calculateVariationsTotal(item);
                const itemTotal = calculateItemTotal(item);
                const isGift = !!(item as any).__couponGiftId;

                return (
                  <div key={item.id} className="flex border-b pb-4">
                    <div className="w-20 h-20 rounded overflow-hidden mr-4 flex-shrink-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "/placeholder.svg";
                        }}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <h3 className="font-medium">{item.name}</h3>
                        {!isGift && (
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Preço base do item */}
                      {!item.isHalfPizza && (
                        <div className="text-sm text-gray-600">
                          {item.priceFrom ? (
                            <span>Item: <span className="text-xs text-gray-500">a partir de</span> {formatCurrency(0)}</span>
                          ) : (
                            <span>Item: {formatCurrency(basePrice)}</span>
                          )}
                        </div>
                      )}

                      {/* Tamanho selecionado */}
                      {item.selectedSize && (
                        <div className="text-xs text-gray-700">
                          Tamanho: <span className="font-medium">{item.selectedSize.name}</span>
                        </div>
                      )}


                      
                      {/* Para pizzas meio a meio, mostrar informações da combinação */}
                      {item.isHalfPizza && item.combination && (
                        <div className="text-sm text-gray-600">
                          <p>Pizza {item.combination.tamanho} - Meio a meio</p>
                          <p className="text-xs">1/2 {item.combination.sabor1.name} + 1/2 {item.combination.sabor2.name}</p>
                          <p className="text-brand font-medium">{formatCurrency(item.price)}</p>
                        </div>
                      )}
                      
                      {/* Variações selecionadas */}
                      {item.selectedVariations && item.selectedVariations.length > 0 && (
                        <div className="mt-2 text-sm">
                          {item.selectedVariations.map((group, index) => (
                            <div key={group.groupId || index} className="mb-1">
                              {group.groupName && (
                                <p className="font-medium text-xs text-gray-700">{group.groupName}:</p>
                              )}
                              {group.variations
                                .filter(v => v.quantity > 0)
                                .map(v => {
                                  const variationPrice = getVariationPrice(v.variationId);
                                  return (
                                    <div key={v.variationId} className="flex justify-between pl-2 text-xs text-gray-600">
                                      <span>
                                        {getVariationName(v.variationId)} x{v.quantity}
                                        {item.isHalfPizza && v.halfSelection && (
                                          <span className="text-orange-600 ml-1">{getHalfSelectionLabel(v.halfSelection)}</span>
                                        )}
                                      </span>
                                      {variationPrice > 0 && (
                                        <span className="text-green-600 font-medium">
                                          +{formatCurrency(variationPrice * v.quantity * (item.isHalfPizza && v.halfSelection === "whole" ? 2 : 1))}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })
                              }
                            </div>
                          ))}
                          
                          {/* Total das variações */}
                          {variationsTotal > 0 && !item.selectedBorder && (
                            <div className="text-xs text-green-600 font-medium border-t border-gray-200 pt-1">
                              Complementos/Adicionais: {formatCurrency(variationsTotal)}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Borda selecionada */}
                      {item.selectedBorder && (
                        <div className="mt-2 text-sm">
                          <p className="font-medium text-xs text-gray-700">Borda:</p>
                          <div className="flex justify-between pl-2 text-xs text-gray-600">
                            <span>{item.selectedBorder.name}</span>
                            {item.selectedBorder.additionalPrice > 0 && (
                              <span className="text-green-600 font-medium">
                                +{formatCurrency(item.selectedBorder.additionalPrice)}
                              </span>
                            )}
                          </div>
                          
                          {/* Total das variações incluindo borda */}
                          {variationsTotal > 0 && (
                            <div className="text-xs text-green-600 font-medium border-t border-gray-200 pt-1 mt-1">
                              Complementos/Adicionais: {formatCurrency(variationsTotal)}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Subtotal unitário */}
                      {!item.isHalfPizza && (
                        <div className="text-sm font-medium text-brand-600 mt-1">
                          Subtotal: {formatCurrency(basePrice + variationsTotal)}
                        </div>
                      )}
                      
                      <div className="flex items-center mt-2">
                        {isGift ? (
                          <span className="text-sm text-muted-foreground italic">
                            Quantidade automática: {item.quantity}
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => decreaseQuantity(item.id)}
                              className="counter-btn"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="mx-2 w-8 text-center">{item.quantity}</span>
                            <button
                              onClick={() => increaseQuantity(item.id)}
                              className="counter-btn"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          </>
                        )}
                        <div className="ml-auto font-bold">
                          {formatCurrency(itemTotal)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Seção de Cupom */}
            <div className="border-t pt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  placeholder="Código do cupom"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  disabled={couponLoading || !!appliedCoupon}
                />
                {appliedCoupon ? (
                  <Button
                    variant="outline"
                    onClick={handleRemoveCoupon}
                    className="shrink-0"
                  >
                    Remover
                  </Button>
                ) : (
                  <Button
                    onClick={handleApplyCoupon}
                    disabled={couponLoading}
                    className="shrink-0"
                  >
                    <Tag className="h-4 w-4 mr-1" />
                    Aplicar
                  </Button>
                )}
              </div>
              
              {appliedCoupon && (
                <div className="bg-green-50 border border-green-200 rounded p-2 text-sm space-y-2">
                  <div className="flex items-center gap-2 text-green-700">
                    <Tag className="h-4 w-4" />
                    <span className="font-medium">{appliedCoupon.nome}</span>
                  </div>
                  <p className="text-green-600 text-xs">
                    {appliedCoupon.tipo === "frete_gratis"
                      ? "🚚 Frete Grátis"
                      : appliedCoupon.tipo === "compre_e_ganhe"
                      ? appliedCoupon.produto_brinde?.modo === "escolha"
                        ? `🎁 Brinde: escolha ${appliedCoupon.produto_brinde?.quantidade || 1}x abaixo`
                        : `🎁 Brinde: ${appliedCoupon.produto_brinde?.quantidade || 1}x ${appliedCoupon.produto_brinde?.product_name || ""}`
                      : `Desconto de ${appliedCoupon.tipo === "percentual" ? `${appliedCoupon.valor}%` : formatCurrency(appliedCoupon.valor)}`}
                  </p>

                  {appliedCoupon.tipo === "compre_e_ganhe" &&
                    appliedCoupon.produto_brinde?.modo === "escolha" && (() => {
                      const requeridos = appliedCoupon.produtos_requeridos || [];
                      const elegiveis = cartItems.filter((item: any) => !String(item.id).startsWith("gift-"));
                      const ciclos = requeridos.length
                        ? Math.min(
                            ...requeridos.map((req: any) => {
                              const totalNoCarrinho = elegiveis
                                .filter((item: any) =>
                                  req.tipo === "categoria"
                                    ? req.category_id && item.category === req.category_id
                                    : item.id === req.product_id
                                )
                                .reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
                              return Math.floor(totalNoCarrinho / Math.max(1, req.quantidade || 1));
                            })
                          )
                        : 1;
                      const totalAlvo = (appliedCoupon.produto_brinde?.quantidade || 1) * Math.max(0, ciclos);
                      const opcoes = appliedCoupon.produto_brinde?.opcoes || [];
                      const escolhas = appliedCoupon.brindes_escolhidos || [];
                      return (
                        <GiftOptionsPicker
                          opcoes={opcoes}
                          escolhas={escolhas}
                          totalAlvo={totalAlvo}
                          onChange={(novas) => setBrindesEscolhidos(novas)}
                        />
                      );
                    })()}
                </div>
              )}

            </div>

            <div className="border-t pt-4 space-y-2">
              {(() => {
                const giftOriginalTotal = cartItems.reduce((s: number, it: any) => {
                  if (!it?.__couponGiftId) return s;
                  const op = Number(it.__originalPrice || 0);
                  return s + op * (it.quantity || 1);
                }, 0);
                return (
                  <div className="flex justify-between text-base items-center">
                    <span>Subtotal</span>
                    <span className="flex items-center gap-2">
                      {giftOriginalTotal > 0 && (
                        <span className="line-through text-red-500 font-semibold">
                          {formatCurrency(cartTotal + giftOriginalTotal)}
                        </span>
                      )}
                      <span>{formatCurrency(cartTotal)}</span>
                    </span>
                  </div>
                );
              })()}
              
              {appliedCoupon && discountAmount > 0 && (
                <div className="flex justify-between text-base text-green-600">
                  <span>Desconto</span>
                  <span>-{formatCurrency(discountAmount)}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(finalTotal)}</span>
              </div>
              
              <Button
                type="button"
                variant="outline"
                className="w-full h-9 bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
                onClick={() => setIsCartOpen(false)}
              >
                🍕 Adicionar mais itens
              </Button>
              <Button 
                className="w-full text-center py-3 bg-food-green hover:bg-opacity-90"
                onClick={handleCheckout}
              >
                Finalizar Pedido
              </Button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ShoppingCart;
