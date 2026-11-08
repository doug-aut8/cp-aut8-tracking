import { useEffect, useRef } from "react";
import { useCart } from "@/contexts/CartContext";
import { supabase } from "@/integrations/supabase/client";
import { getUtmParams } from "@/utils/utmCapture";
import { toast } from "@/hooks/use-toast";

const DONE_KEY = "auto_coupon_done";

/** Aplica cupom automaticamente via ?cupom=CODIGO ou utm_campaign vinculada no admin. */
export default function AutoCouponApplier() {
  const { appliedCoupon, setAppliedCoupon } = useCart();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const search = new URLSearchParams(window.location.search);
    const urlCode = search.get("cupom")?.trim();
    // Lê direto da URL: a captura das UTMs para a sessão pode ainda não ter rodado.
    const urlCampaign = search.get("utm_campaign")?.trim();
    const campaign = urlCampaign || getUtmParams().utm_campaign?.trim();
    const key = `${urlCode || ""}|${campaign || ""}`;
    if (!urlCode && !campaign) return;
    if (!urlCode && !urlCampaign && sessionStorage.getItem(DONE_KEY) === key) return;
    if (appliedCoupon && !urlCode) return;

    (async () => {
      let data: any[] | null = null;
      if (urlCode) {
        ({ data } = await supabase.from("cupons" as any).select("*").eq("ativo", true).ilike("nome", urlCode).limit(1) as any);
      } else {
        ({ data } = await supabase.from("cupons" as any).select("*").eq("ativo", true).ilike("utm_campaign", campaign!).limit(1) as any);
        if (!data?.length) {
          ({ data } = await supabase.from("cupons" as any).select("*").eq("ativo", true).ilike("nome", campaign!).limit(1) as any);
        }
      }
      const c = (data as any[])?.[0];
      sessionStorage.setItem(DONE_KEY, key);
      if (!c) return;

      const today = new Date().toISOString().slice(0, 10);
      if (today < c.data_inicio || today > c.data_fim) return;
      if (c.limite_uso != null) {
        const { count } = await supabase
          .from("cupons_usos" as any)
          .select("*", { count: "exact", head: true })
          .eq("cupom_id", c.id);
        if ((count ?? 0) >= c.limite_uso) return;
      }
      if (appliedCoupon?.id === c.id) return;

      setAppliedCoupon({
        id: c.id,
        nome: c.nome,
        tipo: c.tipo,
        valor: c.valor,
        descricao: c.descricao ?? null,
        usos: c.usos,
        limite_uso: c.limite_uso,
        data_inicio: c.data_inicio,
        data_fim: c.data_fim,
        produtos_requeridos: c.produtos_requeridos ?? null,
        produto_brinde: c.produto_brinde ?? null,
        primeira_compra_apenas: c.primeira_compra_apenas ?? false,
        valor_minimo_pedido: Number(c.valor_minimo_pedido) || 0,
      } as any);
      toast({
        title: "🎉 Cupom ativado!",
        description: `O cupom ${c.nome} já está aplicado no seu carrinho.`,
        variant: "success" as any,
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
