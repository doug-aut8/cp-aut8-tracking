import React, { useState } from "react";
import { Tag, Gift, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/utils";
import { trackCheckoutEvent } from "@/services/checkoutEventService";
import { showPromoRequirementsToast, dismissPromoRequirementsToast } from "@/utils/promoRequirementsToast";
import GiftOptionsPicker from "@/components/GiftOptionsPicker";
import { getFirstPurchaseCouponBlockMessage, validateFirstPurchaseCoupon } from "@/services/couponEligibilityService";


const computeDiscountValue = (cupom: any, cartTotal: number): number => {
  if (!cupom) return 0;
  if (cupom.tipo === "percentual") return Number(((cartTotal * Number(cupom.valor)) / 100).toFixed(2));
  if (cupom.tipo === "fixo") return Number(cupom.valor) || 0;
  return 0;
};

const CouponField: React.FC = () => {
  const { cartItems, cartTotal, appliedCoupon, setAppliedCoupon, setBrindesEscolhidos } = useCart();

  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState("");
  const [couponLoading, setCouponLoading] = useState(false);

  const handleApplyCoupon = async () => {
    const attemptedName = couponCode.trim();
    if (!attemptedName) {
      toast({ title: "Código inválido", description: "Digite um código de cupom", variant: "destructive" });
      return;
    }

    const logInvalid = () =>
      trackCheckoutEvent({
        event_type: "cupom_invalido",
        cart_total: cartTotal,
        discount_value: 0,
        cupom_id: null,
        cupom_name: attemptedName,
      });

    setCouponLoading(true);
    try {
      const { data: cupom, error } = await supabase
        .from("cupons" as any)
        .select("*")
        .ilike("nome", attemptedName)
        .maybeSingle();

      if (error || !cupom) {
        logInvalid();
        toast({ title: "Cupom não encontrado", description: "Código de cupom inválido", variant: "destructive" });
        return;
      }
      const cupomData = cupom as any;

      if (!cupomData.ativo) {
        logInvalid();
        toast({ title: "Cupom inativo", description: "Este cupom não está mais disponível", variant: "destructive" });
        return;
      }

      const today = new Date();
      const dataInicio = new Date(cupomData.data_inicio);
      const dataFim = new Date(cupomData.data_fim);
      if (today < dataInicio || today > dataFim) {
        logInvalid();
        toast({ title: "Cupom expirado", description: "Este cupom não está mais válido", variant: "destructive" });
        return;
      }

      if (cupomData.valor_minimo_pedido && cartTotal < cupomData.valor_minimo_pedido) {
        logInvalid();
        toast({
          title: "Valor mínimo não atingido",
          description: `Pedido mínimo de ${formatCurrency(cupomData.valor_minimo_pedido)} para usar este cupom`,
          variant: "destructive",
        });
        return;
      }

      if (cupomData.limite_uso !== null && cupomData.limite_uso !== undefined) {
        const { count } = await supabase
          .from("cupons_usos" as any)
          .select("*", { count: "exact", head: true })
          .eq("cupom_id", cupomData.id);
        if ((count ?? 0) >= cupomData.limite_uso) {
          logInvalid();
          toast({ title: "Cupom esgotado", description: "Este cupom atingiu o limite de uso", variant: "destructive" });
          return;
        }
      }

      if (currentUser && cupomData.usos_por_usuario !== null && cupomData.usos_por_usuario !== undefined) {
        const { data: userData } = await supabase
          .from("users" as any)
          .select("id")
          .eq("firebase_id", currentUser.uid)
          .maybeSingle();
        const userDataTyped = userData as unknown as { id: string } | null;
        if (userDataTyped?.id) {
          const { count } = await supabase
            .from("cupons_usos" as any)
            .select("*", { count: "exact", head: true })
            .eq("cupom_id", cupomData.id)
            .eq("user_id", userDataTyped.id);
          if ((count ?? 0) >= cupomData.usos_por_usuario) {
            logInvalid();
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
          logInvalid();
          toast({
            title: validation.reason === "login_required" ? "Login necessário" : "Cupom indisponível",
            description: getFirstPurchaseCouponBlockMessage(validation.reason),
            variant: "destructive",
          });
          return;
        }
      }




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

      trackCheckoutEvent({
        event_type: "cupom_aplicado",
        cart_total: cartTotal,
        discount_value: computeDiscountValue(cupomData, cartTotal),
        cupom_id: cupomData.id,
        cupom_name: cupomData.nome,
      });

      const descricaoDesconto =
        cupomData.tipo === "percentual"
          ? `${cupomData.valor}%`
          : cupomData.tipo === "frete_gratis"
          ? "Frete Grátis"
          : cupomData.tipo === "compre_e_ganhe"
          ? `🎁 Brinde: ${cupomData.produto_brinde?.product_name || "produto"}`
          : formatCurrency(cupomData.valor);

      // Para "compre e ganhe" sem requisitos atendidos, mostrar toast amarelo de promoção.
      const reqs = (cupomData.produtos_requeridos || []) as any[];
      const elegiveis = cartItems.filter((i: any) => !i?.__couponGiftId);
      const reqsAtendidos =
        cupomData.tipo !== "compre_e_ganhe" ||
        reqs.length === 0 ||
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
          });
      if (reqsAtendidos) {
        toast({ title: "Cupom aplicado!", description: `Cupom aplicado: ${descricaoDesconto}` });
      } else {
        showPromoRequirementsToast(
          (cupomData.descricao || "").trim() ||
            "Adicione os produtos exigidos para receber o brinde desta promoção."
        );
      }
      setCouponCode("");
    } catch (err) {
      console.error("Erro ao aplicar cupom:", err);
      logInvalid();
      toast({ title: "Erro", description: "Não foi possível aplicar o cupom", variant: "destructive" });
    } finally {
      setCouponLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    dismissPromoRequirementsToast();
    toast({ title: "Cupom removido", description: "O desconto foi removido do seu pedido" });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Código do cupom"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value)}
          disabled={couponLoading || !!appliedCoupon}
        />
        {appliedCoupon ? (
          <Button variant="outline" onClick={handleRemoveCoupon} className="shrink-0">
            Remover
          </Button>
        ) : (
          <Button onClick={handleApplyCoupon} disabled={couponLoading} className="shrink-0">
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
  );
};

export default CouponField;
