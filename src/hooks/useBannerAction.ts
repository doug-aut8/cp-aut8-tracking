import { useCallback } from "react";
import { useCart } from "@/contexts/CartContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLayoutSettings } from "@/hooks/useLayoutSettings";
import { showCouponToast } from "@/utils/couponToast";
import { useAuth } from "@/hooks/useAuth";
import { getFirstPurchaseCouponBlockMessage, validateFirstPurchaseCoupon } from "@/services/couponEligibilityService";


export type BannerActionType = "none" | "link" | "cupom";

const normalizeUrl = (raw: string): string => {
  const v = raw.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (v.startsWith("/")) return v;
  return `https://${v}`;
};

export const useBannerAction = () => {
  const { setAppliedCoupon, appliedCoupon } = useCart();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const { settings } = useLayoutSettings();

  const runAction = useCallback(
    async (type: string | undefined, value: string | undefined, target?: string | undefined) => {
      const t = (type || "none") as BannerActionType;
      const v = (value || "").trim();
      if (t === "none" || !v) return;

      if (t === "link") {
        const url = normalizeUrl(v);
        const openInNew = (target || "new_page") === "new_page";
        if (url.startsWith("/")) {
          if (openInNew) {
            window.open(url, "_blank", "noopener,noreferrer");
          } else {
            window.location.href = url;
          }
        } else {
          if (openInNew) {
            window.open(url, "_blank", "noopener,noreferrer");
          } else {
            window.location.href = url;
          }
        }
        return;
      }

      if (t === "cupom") {
        try {
          const { data: cupom, error } = await supabase
            .from("cupons")
            .select("*")
            .ilike("nome", v)
            .maybeSingle();

          if (error || !cupom) {
            toast({
              title: "Cupom indisponível",
              description: `Não foi possível aplicar o cupom "${v}".`,
              variant: "destructive",
            });
            return;
          }

          const c = cupom as any;
          if (!c.ativo) {
            toast({ title: "Cupom inativo", description: "Este cupom não está disponível.", variant: "destructive" });
            return;
          }
          const now = new Date();
          if (c.data_inicio && new Date(c.data_inicio) > now) {
            toast({ title: "Cupom ainda não disponível", description: "Tente novamente mais tarde.", variant: "destructive" });
            return;
          }
          if (c.data_fim && new Date(c.data_fim) < now) {
            toast({ title: "Cupom expirado", description: "Este cupom não está mais válido.", variant: "destructive" });
            return;
          }

          if (appliedCoupon && appliedCoupon.id === c.id) {
            toast({ title: "Cupom já aplicado", description: `O cupom ${c.nome} já está no seu carrinho.` });
            return;
          }

          if (c.primeira_compra_apenas) {
            const validation = await validateFirstPurchaseCoupon(c, currentUser);
            if (!validation.eligible) {
              toast({
                title: validation.reason === "login_required" ? "Login necessário" : "Cupom indisponível",
                description: getFirstPurchaseCouponBlockMessage(validation.reason),
                variant: "destructive",
              });
              return;
            }
          }

          setAppliedCoupon({
            id: c.id,
            nome: c.nome,
            tipo: c.tipo,
            valor: Number(c.valor) || 0,
            descricao: (c as any).descricao ?? null,
            usos: c.usos ?? null,
            limite_uso: c.limite_uso ?? null,
            data_inicio: c.data_inicio,
            data_fim: c.data_fim,
            produtos_requeridos: c.produtos_requeridos ?? null,
            produto_brinde: c.produto_brinde ?? null,
            primeira_compra_apenas: c.primeira_compra_apenas ?? false,
          });

          const template =
            (settings as any)?.cupom_aplicado_mensagem?.trim() ||
            "O cupom {cupom} foi aplicado automaticamente ao seu pedido.";
          const baseMessage = template.replace(/\{cupom\}/gi, c.nome);
          const cupomDescricao = (c.descricao || "").trim();
          showCouponToast({
            title: "Cupom aplicado!",
            description: cupomDescricao
              ? `${c.nome}: ${cupomDescricao}`
              : baseMessage,
          });

        } catch (err) {
          console.error("Erro ao aplicar cupom do banner:", err);
          toast({ title: "Erro", description: "Não foi possível aplicar o cupom.", variant: "destructive" });
        }
      }
    },
    [appliedCoupon, currentUser, setAppliedCoupon, toast, settings]
  );

  return runAction;
};