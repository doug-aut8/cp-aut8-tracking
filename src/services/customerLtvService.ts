import { supabase } from "@/integrations/supabase/client";
import { cachedFetch } from "./queryCache";
import { aggregateCustomerLtv, type CustomerLtvOrder } from "./customerLtvAggregation";

export async function fetchCustomerLtv() {
  const history = await cachedFetch("customer-ltv|history", async () => {
    const rows: CustomerLtvOrder[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.from("pedidos_sabor_delivery")
        .select("id, telefone_cliente, nome_cliente, user_email, data_criacao, status_atual, valor_total, utm_source, utm_campaign")
        .order("data_criacao").order("id").range(offset, offset + 999);
      if (error) throw new Error(error.message);
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < 1000) return rows;
    }
  }, 5 * 60_000);
  return aggregateCustomerLtv(history);
}