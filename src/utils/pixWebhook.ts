import { supabase } from "@/integrations/supabase/client";
import { withComunicacaoMeta } from "@/utils/webhookPayload";
import { phoneDigitsBr } from "@/utils/phoneUtils";

interface PixWebhookInput {
  orderId: string;
  total: number;
  subtotal?: number;
  frete?: number;
  discount?: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
}

/** Dispara o "Webhook PIX" (configuracoes.webhook_pix) após criar um pedido pago via PIX. */
export const firePixWebhook = async (input: PixWebhookInput) => {
  try {
    const [{ data: cfg }, { data: empresa }] = await Promise.all([
      supabase.from("configuracoes").select("valor").eq("chave", "webhook_pix").maybeSingle(),
      supabase.from("empresa_info").select("*").limit(1).maybeSingle(),
    ]);
    const url = cfg?.valor;
    if (!url) {
      console.warn("Webhook PIX não configurado.");
      return;
    }
    const e: any = empresa || {};
    const payload = await withComunicacaoMeta({
      event: "pix_payment",
      occurred_at: new Date().toISOString(),
      pix: {
        nome_recebedor: e.pix_nome_recebedor || null,
        chave: e.pix_chave || null,
        cidade: e.pix_cidade || null,
      },
      cliente: {
        nome: input.customerName,
        whatsapp: input.customerPhone,
        email: input.customerEmail || null,
      },
      pedido: {
        id: input.orderId,
        codigo: input.orderId.substring(0, 6),
        valor: input.total,
        subtotal: input.subtotal ?? null,
        frete: input.frete ?? null,
        desconto: input.discount ?? null,
      },
    });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("Falha no Webhook PIX:", res.status);
  } catch (err) {
    console.error("Erro ao disparar Webhook PIX:", err);
  }
};
